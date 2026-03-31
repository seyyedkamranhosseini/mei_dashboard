// quick-setup.js
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

async function runCommand(cmd, description) {
  console.log(`\n📌 ${description}...`);
  try {
    const { stdout, stderr } = await execAsync(cmd);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`✅ ${description} complete`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

async function setup() {
  console.log("🚀 Starting new project setup...\n");

  try {
    // await runCommand('pnpm install', 'Installing dependencies');
    await runCommand(
      "node setup-db-user.js",
      "Setting up MySQL database and user"
    );
    await runCommand("pnpm db:push", "Running database migrations");
    await runCommand("node setup-admin-fixed.mjs", "Creating admin users");
    await runCommand("node check-users.js", "Verifying setup");

    console.log('\n✨ Setup complete! Run "pnpm dev" to start the app.');
  } catch (error) {
    console.error("\n❌ Setup failed:", error.message);
  }
}

setup();
