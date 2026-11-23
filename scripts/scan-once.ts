/**
 * Run the full pipeline once from your terminal. Useful for the first run,
 * for tuning filters, and for checking your Sheet/Notion wiring before deploying.
 *
 *   npm run scan
 */
import 'dotenv/config';
import { runPipeline } from '../lib/pipeline';

runPipeline()
  .then((r) => {
    console.log('Fetched from Freelancer :', r.fetched);
    console.log('Not seen before         :', r.new_projects);
    console.log('Passed prefilter, scored:', r.scored);
    console.log('Cleared the threshold   :', r.kept);
    console.log('Written to destination  :', r.pushed);
  })
  .catch((err) => {
    console.error('Scan failed:', err.message);
    process.exit(1);
  });
