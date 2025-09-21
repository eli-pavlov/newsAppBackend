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
console.log("Get backend git info....");
console.log(gitInfo);

fs.writeFileSync("./backend_git_info.json", JSON.stringify(gitInfo, null, 2));
