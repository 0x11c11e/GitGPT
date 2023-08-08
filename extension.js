// Import the required modules
const vscode = require("vscode");
const axios = require("axios");
const git = require("simple-git");

/**
 * This method is called when the extension is activated.
 * It registers the 'gitgpt' command and creates a status bar item that calls the command.
 * @param {vscode.ExtensionContext} context - The context of the extension.
 */
function activate(context) {
  /**
   * This command prompts the user for their OpenAI key if it's not already stored,
   * gets the diff of the staged files, sends the diff to the OpenAI API as the prompt,
   * and opens the response from the API in a new markdown editor tab.
   */
  let disposable = vscode.commands.registerCommand("gitgpt", async () => {
    // Prompt the user to enter their OpenAI key if it's not already stored
    let openAIKey = context.globalState.get("openAIKey");
    if (!openAIKey) {
      openAIKey = await vscode.window.showInputBox({
        prompt: "Enter your OpenAI key",
      });
      if (!openAIKey) {
        vscode.window.showErrorMessage("No OpenAI key entered.");
        return;
      }
      await context.globalState.update("openAIKey", openAIKey);
    }

    // Get the current workspace folder
    let workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("No workspace is currently opened.");
      return;
    }

    // Use the first workspace folder as the git repository
    let workspaceFolder = workspaceFolders[0];
    let gitRepo = git(workspaceFolder.uri.fsPath);

    // Get the diff of the git repository
    gitRepo.diff(["--staged"], async (err, diff) => {
      if (err) {
        vscode.window.showErrorMessage("Error getting git diff: " + err);
        return;
      }

      // Truncate the diff if it's too large for the OpenAI API
      if (diff.length > 4096) {
        diff = diff.substring(0, 4096);
      }

      // Get the diff of the git repository
      gitRepo.diff(["--staged"], async (err, diff) => {
        if (err) {
          vscode.window.showErrorMessage("Error getting git diff: " + err);
          return;
        }

        // Send the diff to the OpenAI API to generate a commit comment
        try {
          let response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
              model: "gpt-3.5-turbo-16k-0613",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful assistant that generates commit messages based on code changes.",
                },
                {
                  role: "user",
                  content:
                    "Here are the code changes in the following files: " + diff,
                },
                { role: "assistant", content: diff.replace(/\n/g, "\\n") },
                {
                  role: "user",
                  content: "Generate a commit message for these changes.",
                },
              ],
            },
            {
              headers: {
                Authorization: `Bearer ${openAIKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          // Create a new text document with the generated commit comment
          let commitComment = response.data.choices[0].message.content.trim();
          let doc = await vscode.workspace.openTextDocument({
            content: commitComment,
            language: "markdown",
          });

          // Open the document in a new editor tab
          vscode.window.showTextDocument(doc);
        } catch (err) {
          vscode.window.showErrorMessage(
            "Error generating commit message: " + err
          );
        }
      });
    });
  });

  context.subscriptions.push(disposable);

  // Create a new status bar item that calls the 'gitgpt' command
  let statusBarIcon = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  statusBarIcon.command = "gitgpt";
  statusBarIcon.text = "$(comment) Generate Commit Message"; // $(comment) is an example icon
  statusBarIcon.show();

  context.subscriptions.push(statusBarIcon);
}

/**
 * This method is called when the extension is deactivated.
 */
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
