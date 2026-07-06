import { createClient } from "@libsql/client";

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:blogforce.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = initSchema();
  return initPromise;
}

async function initSchema() {
  const client = getClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS blogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      topic TEXT NOT NULL,
      keywords TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      content_type TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      compliance_passed INTEGER DEFAULT 0,
      compliance_risk_score REAL DEFAULT 0,
      compliance_violations TEXT DEFAULT '[]',
      plagiarism_score REAL DEFAULT 0,
      plagiarism_passed INTEGER DEFAULT 1,
      seo_keywords_found INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      tokens_used INTEGER DEFAULT 0,
      cost_inr REAL DEFAULT 0,
      meta_title TEXT DEFAULT '',
      meta_description TEXT DEFAULT '',
      url_slug TEXT DEFAULT '',
      schema_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blog_id INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      model TEXT,
      cost_inr REAL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  for (const col of [
    "ALTER TABLE blogs ADD COLUMN meta_title TEXT DEFAULT ''",
    "ALTER TABLE blogs ADD COLUMN meta_description TEXT DEFAULT ''",
    "ALTER TABLE blogs ADD COLUMN url_slug TEXT DEFAULT ''",
    "ALTER TABLE blogs ADD COLUMN schema_json TEXT DEFAULT '{}'",
  ]) {
    try { await client.execute(col); } catch {}
  }
}

export interface Blog {
  id: number;
  brand: string;
  topic: string;
  keywords: string;
  target_audience: string;
  content_type: string;
  content: string;
  status: string;
  compliance_passed: number;
  compliance_risk_score: number;
  compliance_violations: string;
  plagiarism_score: number;
  plagiarism_passed: number;
  seo_keywords_found: number;
  word_count: number;
  tokens_used: number;
  cost_inr: number;
  meta_title: string;
  meta_description: string;
  url_slug: string;
  schema_json: string;
  created_at: string;
  updated_at: string;
}

export const blogsDb = {
  async insert(data: Omit<Blog, "id" | "created_at" | "updated_at">): Promise<number> {
    await ensureInit();
    const client = getClient();
    const result = await client.execute({
      sql: `INSERT INTO blogs (
        brand, topic, keywords, target_audience, content_type, content,
        status, compliance_passed, compliance_risk_score, compliance_violations,
        plagiarism_score, plagiarism_passed, seo_keywords_found,
        word_count, tokens_used, cost_inr,
        meta_title, meta_description, url_slug, schema_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.brand, data.topic, data.keywords, data.target_audience,
        data.content_type, data.content, data.status,
        data.compliance_passed, data.compliance_risk_score, data.compliance_violations,
        data.plagiarism_score, data.plagiarism_passed, data.seo_keywords_found,
        data.word_count, data.tokens_used, data.cost_inr,
        data.meta_title, data.meta_description, data.url_slug, data.schema_json,
      ],
    });
    return Number(result.lastInsertRowid);
  },

  async getAll(): Promise<Blog[]> {
    await ensureInit();
    const client = getClient();
    const result = await client.execute("SELECT * FROM blogs ORDER BY created_at DESC");
    return result.rows as unknown as Blog[];
  },

  async getById(id: number): Promise<Blog | undefined> {
    await ensureInit();
    const client = getClient();
    const result = await client.execute({
      sql: "SELECT * FROM blogs WHERE id = ?",
      args: [id],
    });
    return result.rows[0] as unknown as Blog | undefined;
  },

  async getByBrand(brand: string): Promise<Blog[]> {
    await ensureInit();
    const client = getClient();
    const result = await client.execute({
      sql: "SELECT * FROM blogs WHERE brand = ? ORDER BY created_at DESC",
      args: [brand],
    });
    return result.rows as unknown as Blog[];
  },

  async updateStatus(id: number, status: string): Promise<void> {
    await ensureInit();
    const client = getClient();
    await client.execute({
      sql: "UPDATE blogs SET status = ?, updated_at = datetime('now') WHERE id = ?",
      args: [status, id],
    });
  },

  async getStats(): Promise<{
    total_blogs: number;
    total_cost: number;
    total_tokens: number;
    avg_risk_score: number;
    avg_plagiarism: number;
    compliant_blogs: number;
    approved_blogs: number;
  }> {
    await ensureInit();
    const client = getClient();
    const result = await client.execute(`
      SELECT
        COUNT(*) as total_blogs,
        SUM(cost_inr) as total_cost,
        SUM(tokens_used) as total_tokens,
        AVG(compliance_risk_score) as avg_risk_score,
        AVG(plagiarism_score) as avg_plagiarism,
        SUM(CASE WHEN compliance_passed = 1 THEN 1 ELSE 0 END) as compliant_blogs,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_blogs
      FROM blogs
    `);
    return result.rows[0] as unknown as {
      total_blogs: number;
      total_cost: number;
      total_tokens: number;
      avg_risk_score: number;
      avg_plagiarism: number;
      compliant_blogs: number;
      approved_blogs: number;
    };
  },

  async getBrandBreakdown(): Promise<{
    brand: string;
    blogs_count: number;
    total_cost: number;
    avg_cost: number;
    compliant_count: number;
  }[]> {
    await ensureInit();
    const client = getClient();
    const result = await client.execute(`
      SELECT brand,
        COUNT(*) as blogs_count,
        SUM(cost_inr) as total_cost,
        AVG(cost_inr) as avg_cost,
        SUM(CASE WHEN compliance_passed = 1 THEN 1 ELSE 0 END) as compliant_count
      FROM blogs
      GROUP BY brand
      ORDER BY total_cost DESC
    `);
    return result.rows as unknown as {
      brand: string;
      blogs_count: number;
      total_cost: number;
      avg_cost: number;
      compliant_count: number;
    }[];
  },

  async getMonthlyUsage(): Promise<{
    month: string;
    blogs_count: number;
    total_cost: number;
    total_tokens: number;
  }[]> {
    await ensureInit();
    const client = getClient();
    const result = await client.execute(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as blogs_count,
        SUM(cost_inr) as total_cost,
        SUM(tokens_used) as total_tokens
      FROM blogs
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `);
    return result.rows as unknown as {
      month: string;
      blogs_count: number;
      total_cost: number;
      total_tokens: number;
    }[];
  },
};
