import fs from "fs";
import path from "path";

export default async function globalSetup() {
  const dir = path.resolve(__dirname, "../.test-data");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "manga"), { recursive: true });
}
