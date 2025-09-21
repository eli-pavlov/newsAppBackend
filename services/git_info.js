const fs = require('fs');
const { execSync } = require("child_process");

function getGitInfo() {
  let branch = 'unknown'
  let commit = 'unknown'
  try {
    if (process.env.RENDER_GIT_BRANCH) {
      console.log("GET GIT INFO FROM RENDER...");
      branch = process.env.RENDER_GIT_BRANCH;
      commit = process.env.RENDER_GIT_COMMIT.substring(0, 7);
    }
    else {
      console.log("GET GIT INFO FROM JSON FILE...");
      branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
      commit = execSync("git rev-parse --short HEAD").toString().trim();
    }

    return { branch, commit };
  }
  catch (err) {
    return { branch, commit };
  }
}

const gitInfo = getGitInfo();
console.log("Get backend git info....");
console.log(gitInfo);

fs.writeFileSync("./backend_git_info.json", JSON.stringify(gitInfo, null, 2));
