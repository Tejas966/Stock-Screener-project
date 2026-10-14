-- FundamentalX - initial relational schema (MySQL 8)
--
-- Table ownership (who is allowed to WRITE each table):
--   Node.js gateway : users, user_sessions, sectors, companies, quote_cache,
--                     price_history_cache, financial_periods, financial_line_items,
--                     watchlist_items, search_history, ai_explanations
--   PHP service     : saved_screens, research_notes
-- PHP may READ users/companies (to check existence); Node never writes the
-- PHP-owned tables directly - it goes through the PHP service API.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Accounts and sessions (owner: Node)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(254) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  preferred_period ENUM('annual','quarterly') NOT NULL DEFAULT 'annual',
  preferred_unit   ENUM('crore','lakh') NOT NULL DEFAULT 'crore',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Server-side sessions. Only a SHA-256 hash of the random session token is
-- stored, so a database leak does not reveal usable cookies.
CREATE TABLE user_sessions (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  token_hash   CHAR(64) NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Company universe (owner: Node, seeded)
-- ---------------------------------------------------------------------------
CREATE TABLE sectors (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sector_name  VARCHAR(80) NOT NULL,
  sector_slug  VARCHAR(80) NOT NULL,
  description  VARCHAR(400) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sectors_name (sector_name),
  UNIQUE KEY uq_sectors_slug (sector_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per exchange listing. The same company listed on NSE and BSE has
-- two rows that share an ISIN, so search can show both and let the user pick.
CREATE TABLE companies (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_name  VARCHAR(160) NOT NULL,
  symbol        VARCHAR(32)  NOT NULL,   -- provider symbol, e.g. RELIANCE.NS / 500325.BO
  ticker        VARCHAR(20)  NOT NULL,   -- exchange ticker, e.g. RELIANCE / 500325
  exchange      ENUM('NSE','BSE') NOT NULL,
  isin          CHAR(12) NULL,
  sector_id     SMALLINT UNSIGNED NULL,
  industry      VARCHAR(120) NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'INR',
  is_featured   TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_companies_symbol (symbol),
  UNIQUE KEY uq_companies_exchange_ticker (exchange, ticker),
  KEY idx_companies_name (company_name),
  KEY idx_companies_isin (isin),
  CONSTRAINT fk_companies_sector FOREIGN KEY (sector_id) REFERENCES sectors (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Market-data caches (owner: Node). Each row records its source so demo data
-- can never be mistaken for provider data.
-- ---------------------------------------------------------------------------
CREATE TABLE quote_cache (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    INT UNSIGNED NOT NULL,
  source        VARCHAR(40) NOT NULL,
  price         DECIMAL(14,4) NOT NULL,
  currency      CHAR(3) NOT NULL,
  change_pct    DECIMAL(9,4) NULL,
  shares_outstanding BIGINT UNSIGNED NULL,
  market_cap    DECIMAL(22,2) NULL,
  dividend_per_share DECIMAL(12,4) NULL,
  observed_at   DATETIME NOT NULL,          -- time the price refers to (provider)
  retrieved_at  DATETIME NOT NULL,          -- time we fetched it
  PRIMARY KEY (id),
  UNIQUE KEY uq_quote_company_source (company_id, source),
  CONSTRAINT fk_quote_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE price_history_cache (
  company_id    INT UNSIGNED NOT NULL,
  source        VARCHAR(40) NOT NULL,
  trade_date    DATE NOT NULL,
  close_price   DECIMAL(14,4) NOT NULL,
  volume        BIGINT UNSIGNED NULL,
  retrieved_at  DATETIME NOT NULL,
  PRIMARY KEY (company_id, source, trade_date),
  CONSTRAINT fk_history_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per (company, source, period). Line items live in a child table so
-- that income, balance-sheet and cash-flow concepts stay separately typed.
CREATE TABLE financial_periods (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    INT UNSIGNED NOT NULL,
  source        VARCHAR(40) NOT NULL,
  period_type   ENUM('annual','quarterly') NOT NULL,
  fiscal_year   SMALLINT UNSIGNED NOT NULL,
  fiscal_period VARCHAR(4) NOT NULL,          -- FY, Q1..Q4
  period_end    DATE NOT NULL,
  currency      CHAR(3) NOT NULL,
  reported_at   DATE NULL,                     -- filing date if the provider gives one
  retrieved_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_period (company_id, source, period_type, period_end),
  CONSTRAINT fk_periods_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE financial_line_items (
  period_id     BIGINT UNSIGNED NOT NULL,
  statement     ENUM('income','balance','cashflow') NOT NULL,
  item_key      VARCHAR(48) NOT NULL,
  value         DECIMAL(22,4) NULL,            -- NULL = not reported (never 0)
  PRIMARY KEY (period_id, statement, item_key),
  CONSTRAINT fk_items_period FOREIGN KEY (period_id) REFERENCES financial_periods (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cached Gemini explanations. input_hash is a SHA-256 of the exact factual
-- payload sent to the model, so a material data change produces a new key.
CREATE TABLE ai_explanations (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    INT UNSIGNED NOT NULL,
  input_hash    CHAR(64) NOT NULL,
  model         VARCHAR(80) NOT NULL,
  response_json JSON NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_company_hash (company_id, input_hash, model),
  CONSTRAINT fk_ai_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- User data owned by Node
-- ---------------------------------------------------------------------------
CREATE TABLE watchlist_items (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  company_id  INT UNSIGNED NOT NULL,
  added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_watchlist_user_company (user_id, company_id),
  CONSTRAINT fk_watch_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_watch_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE search_history (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id             INT UNSIGNED NOT NULL,
  query               VARCHAR(100) NOT NULL,
  resolved_company_id INT UNSIGNED NULL,
  searched_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_history_user_time (user_id, searched_at),
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_history_resolved FOREIGN KEY (resolved_company_id) REFERENCES companies (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- User data owned by the PHP persistence service
-- ---------------------------------------------------------------------------
CREATE TABLE saved_screens (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  name         VARCHAR(80) NOT NULL,
  description  VARCHAR(300) NULL,
  criteria     JSON NOT NULL,       -- validated {filters:{...}, sort:{...}}
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_screens_user_name (user_id, name),
  CONSTRAINT fk_screens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE research_notes (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  company_id   INT UNSIGNED NULL,
  title        VARCHAR(150) NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notes_user_updated (user_id, updated_at),
  CONSTRAINT fk_notes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
