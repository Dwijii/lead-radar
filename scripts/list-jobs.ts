/**
 * Look up Freelancer skill (job) IDs so you can pin searchConfig.jobIds.
 *
 *   npm run jobs -- crm
 *   npm run jobs -- "google analytics"
 *   npm run jobs            # prints all, several hundred lines
 */
import 'dotenv/config';
import { listJobs } from '../lib/freelancer';

const needle = process.argv.slice(2).join(' ').toLowerCase();

listJobs()
  .then((jobs) => {
    const matches = needle ? jobs.filter((j) => j.name?.toLowerCase().includes(needle)) : jobs;
    if (!matches.length) {
      console.log(`No skills matched "${needle}".`);
      return;
    }
    for (const j of matches.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(String(j.id).padStart(6), j.name, j.category ? `(${j.category})` : '');
    }
    console.log(`\n${matches.length} match(es). Copy the IDs into searchConfig.jobIds.`);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
