const fs = require("fs");
const path = require("path");

async function copyDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const src = path.join(root, "assets");
  const dest = path.join(root, "dist", "assets");
  try {
    const stat = await fs.promises.stat(src);
    if (!stat.isDirectory()) {
      console.error("No assets directory found to copy.");
      process.exit(0);
    }
  } catch (err) {
    console.error("No assets directory found to copy.");
    process.exit(0);
  }

  try {
    await copyDir(src, dest);
    console.log("Copied assets to", dest);
  } catch (err) {
    console.error("Failed to copy assets", err);
    process.exit(1);
  }
}

main();
