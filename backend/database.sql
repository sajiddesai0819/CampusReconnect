-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS claims;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS users;

-- Create the 'users' table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    usn VARCHAR(50) UNIQUE NOT NULL,
    semester VARCHAR(10),
    branch VARCHAR(100),
    mobile VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user' NOT NULL,
    has_pfp BOOLEAN DEFAULT FALSE,
    pfp_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the 'items' table
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    item_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'public' NOT NULL,
    has_image BOOLEAN DEFAULT FALSE,
    image_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the 'claims' table
CREATE TABLE claims (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    claimer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    verification_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, claimer_id)
);

-- Create indexes for faster searching
CREATE INDEX idx_items_search ON items (title, description);
CREATE INDEX idx_items_type_status ON items (item_type, status);

-- Create a default admin user
-- Password: adminpass (you should change this!)
INSERT INTO users (username, email, password_hash, usn, role)
VALUES (
    'admin',
    'admin@campus.reconnect',
    '$2b$10$rT0vlvGU7EQ3H5mEKw/7eOMrGfKlHqbX5L5L5L5L5L5L5L5L5L5L5O',
    'ADMIN',
    'admin'
);

-- Note: The password_hash above is a placeholder. 
-- You'll need to generate a real bcrypt hash for 'adminpass' or your desired password
-- You can do this by running the following in Node.js:
-- const bcrypt = require('bcryptjs');
-- bcrypt.hash('adminpass', 10).then(console.log);