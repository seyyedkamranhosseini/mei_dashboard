-- Inspection Dashboard Database Schema
-- MySQL/TiDB Compatible

-- Users table with auth support
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) NOT NULL UNIQUE,
  username VARCHAR(100) UNIQUE,
  passwordHash TEXT,
  name TEXT,
  email VARCHAR(320) NOT NULL UNIQUE,
  loginMethod VARCHAR(64),
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  isActive BOOLEAN NOT NULL DEFAULT true,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_username (username),
  INDEX idx_role (role)
);

-- Daily Field Reports table
CREATE TABLE IF NOT EXISTS daily_field_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,

  -- Job Information
  jobNo VARCHAR(100) NOT NULL,
  permitNo VARCHAR(100) NOT NULL,
  irNo VARCHAR(100),
  projectName VARCHAR(255) NOT NULL,
  client VARCHAR(255) NOT NULL,
  location TEXT NOT NULL,
  contractor VARCHAR(255) NOT NULL,
  reviewedBy VARCHAR(255),

  -- Date, Time & Weather
  date TIMESTAMP NOT NULL,
  weather VARCHAR(100),

  -- Inspection Types
  inspectionTypes JSON NOT NULL,

  -- Conformance
  workConformance ENUM('met', 'not_met') NOT NULL,
  workRequirements ENUM('met', 'not_met') NOT NULL DEFAULT 'met',
  materialSampling ENUM('performed', 'not_performed') NOT NULL,

  -- Notes
  notes TEXT,

  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX idx_userId (userId),
  INDEX idx_status (status),
  INDEX idx_createdAt (createdAt)
);

-- Concrete Tests table
CREATE TABLE IF NOT EXISTS concrete_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,

  -- Project Information
  permitNo VARCHAR(100) NOT NULL,
  fileNo VARCHAR(100),
  meiProjectNoName VARCHAR(255) NOT NULL,
  contractor VARCHAR(255) NOT NULL,
  subContractor VARCHAR(255),
  buildingNo VARCHAR(100),
  floorDeck VARCHAR(100),
  other VARCHAR(100),
  specificLocation TEXT,

  -- Placement Type
  footing BOOLEAN NOT NULL DEFAULT false,
  postTension BOOLEAN NOT NULL DEFAULT false,
  masonryWall BOOLEAN NOT NULL DEFAULT false,
  `columns` BOOLEAN NOT NULL DEFAULT false,
  walls BOOLEAN NOT NULL DEFAULT false,
  masonryColumns BOOLEAN NOT NULL DEFAULT false,
  slabOnGrade BOOLEAN NOT NULL DEFAULT false,
  beams BOOLEAN NOT NULL DEFAULT false,
  masonryPrisms BOOLEAN NOT NULL DEFAULT false,

  -- Sample Information
  supplier VARCHAR(255),
  material VARCHAR(255),
  sampledBy VARCHAR(255),
  ticketNo VARCHAR(100),
  dateSampled TIMESTAMP NULL,
  time VARCHAR(10),
  loadNo VARCHAR(100),
  dateReceived TIMESTAMP NULL,
  setNo VARCHAR(100),
  truckNo VARCHAR(100),
  weather VARCHAR(100),
  mixDesignNo VARCHAR(100),
  cementFactorSkCy DECIMAL(10,3),
  maxSizeAggIn DECIMAL(10,3),
  admixture VARCHAR(255),
  specifiedStrengthPsi INT,

  -- Specified vs Measured
  slumpInSpecified DECIMAL(6,2),
  slumpInMeasured DECIMAL(6,2),
  mixTempFSpecified DECIMAL(6,2),
  mixTempFMeasured DECIMAL(6,2),
  airTempFSpecified DECIMAL(6,2),
  airTempFMeasured DECIMAL(6,2),
  airContentSpecified DECIMAL(6,2),
  airContentMeasured DECIMAL(6,2),

  -- Specimen Data (7 specimens as JSON array)
  specimens JSON NOT NULL,

  -- Comments & Status
  comments TEXT,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX idx_userId (userId),
  INDEX idx_status (status),
  INDEX idx_createdAt (createdAt)
);

-- Approvals table
CREATE TABLE IF NOT EXISTS approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  formType ENUM('daily', 'concrete') NOT NULL,
  formId INT NOT NULL,
  adminId INT NOT NULL,
  decision ENUM('approved', 'rejected') NOT NULL,
  comments TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (adminId) REFERENCES users(id),
  INDEX idx_formType (formType),
  INDEX idx_formId (formId),
  INDEX idx_adminId (adminId)
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  formType ENUM('daily', 'concrete') NOT NULL,
  formId INT NOT NULL,
  userId INT NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  fileKey VARCHAR(255) NOT NULL,
  fileUrl TEXT NOT NULL,
  mimeType VARCHAR(100) NOT NULL,
  fileSize INT NOT NULL,
  uploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  INDEX idx_formType (formType),
  INDEX idx_formId (formId),
  INDEX idx_userId (userId),
  INDEX idx_uploadedAt (uploadedAt)
);

-- Form Templates table
CREATE TABLE IF NOT EXISTS form_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  createdBy INT NOT NULL,
  formType ENUM('daily', 'concrete') NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  templateData JSON NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT true,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (createdBy) REFERENCES users(id),
  INDEX idx_formType (formType),
  INDEX idx_isActive (isActive)
);
