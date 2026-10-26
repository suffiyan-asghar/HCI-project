// Vercel serverless entry: the same Express app as `npm start`, minus serving the built
// files (Vercel serves dist itself). vercel.json sends every /api/* request here.
//
// Online, both settings are required: Vercel's disk is temporary, so SQLite would lose
// data, and without a password anyone with the link could read the study data.
for (const name of ['DATABASE_URL', 'RESEARCHER_PASSWORD']) {
  if (!process.env[name]) throw new Error(`Set ${name} in Vercel > Settings > Environment Variables, then redeploy.`);
}
const { createApp } = await import('../server/index.js');

export default createApp();
