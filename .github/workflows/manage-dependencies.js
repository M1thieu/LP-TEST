const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

async function updateLabels(issueNumber, action) {
  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  if (action === 'closed') {
    // Find issues that are blocked by this one
    const issues = await octokit.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} is:open is:issue in:comments Blocks #${issueNumber}`
    });

    for (const dependentIssue of issues.data.items) {
      const comments = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: dependentIssue.number,
      });

      let allDependenciesResolved = true;

      for (const comment of comments.data) {
        const match = comment.body.match(/Depends on #(\d+)/);
        if (match) {
          const dependencyNumber = parseInt(match[1], 10);
          const dependency = await octokit.issues.get({
            owner,
            repo,
            issue_number: dependencyNumber,
          });

          if (dependency.data.state !== 'closed') {
            allDependenciesResolved = false;
            break;
          }
        }
      }

      if (allDependenciesResolved) {
        await octokit.issues.removeLabel({
          owner,
          repo,
          issue_number: dependentIssue.number,
          name: 'Dependent',
        });

        await octokit.issues.addLabels({
          owner,
          repo,
          issue_number: dependentIssue.number,
          labels: ['Independent'],
        });
      }
    }
  }
}

(async () => {
  const issueNumber = process.env.GITHUB_EVENT_PATH.split("/").pop();
  const action = process.env.GITHUB_EVENT_NAME === 'issues' ? process.env.GITHUB_EVENT_ACTION : null;
  if (action) {
    await updateLabels(issueNumber, action);
  }
})();
