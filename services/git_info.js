const fs = require('fs');
const { execSync } = require("child_process");

function getGitInfo() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    const commit = execSync("git rev-parse --short HEAD").toString().trim();

    return { branch, commit };
  } 
  catch (err) {
    return { branch: "unknown", commit: "unknown" };
  }
}

const gitInfo = getGitInfo();
fs.writeFileSync("./git_info.json", JSON.stringify(gitInfo, null, 2));
