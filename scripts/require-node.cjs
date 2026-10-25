// Runs before `npm start` and `npm run server`, in any Node version, so an old Node gets a
// clear message instead of "bad option" or a missing node:sqlite.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`
StudyBot needs Node.js 22.13 or newer, but this is Node ${process.versions.node}.
Install a newer Node (see "Setting up the server laptop" in README.md), then run npm start again.
`);
  process.exit(1);
}
