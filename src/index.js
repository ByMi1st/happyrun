#!/usr/bin/env node
import inquirer from 'inquirer';
import chalk from 'chalk';
import { login, getSession } from './lib/auth.js';
import { executeCampusRun } from './lib/run.js';
import {
  getMyClubProjects,
  queryActivities,
  queryMyActivities,
  joinActivity,
  autoSignIn,
} from './lib/club.js';

async function main() {
  console.log(chalk.bold('\n  === byerun ===\n'));

  const { phone, password } = await inquirer.prompt([
    { type: 'input', name: 'phone', message: 'Phone:' },
    { type: 'password', name: 'password', message: 'Password:', mask: '*' },
  ]);

  try {
    console.log('\n  Logging in...');
    const session = await login(phone, password);
    console.log(chalk.green(`  Welcome, ${session.studentName} (${session.schoolName})\n`));
  } catch (e) {
    console.log(chalk.red(`  Login failed: ${e.message}`));
    process.exit(1);
  }

  await mainMenu();
}

async function mainMenu() {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select:',
        choices: [
          { name: '1. Campus Run (auto)', value: 'run' },
          { name: '2. Club Activities', value: 'club' },
          { name: '3. Exit', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') break;

    try {
      if (action === 'run') await handleRun();
      else if (action === 'club') await handleClub();
    } catch (e) {
      console.log(chalk.red(`  Error: ${e.message}`));
    }

    console.log('');
  }
}

async function handleRun() {
  console.log('');
  const result = await executeCampusRun();
  if (result) {
    console.log(chalk.green(`  Run submitted! Record: ${result.recordId || 'OK'}`));
    if (result.resultDesc) console.log(`  ${result.resultDesc}`);
  }
}

async function handleClub() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Club:',
      choices: [
        { name: 'View today\'s activities', value: 'list' },
        { name: 'View a specific date', value: 'date' },
        { name: 'My joined activities', value: 'mine' },
        { name: 'Join an activity', value: 'join' },
        { name: 'Auto sign-in / sign-back', value: 'sign' },
        { name: 'Back', value: 'back' },
      ],
    },
  ]);

  if (action === 'back') return;

  if (action === 'list' || action === 'date') {
    let date;
    if (action === 'date') {
      const ans = await inquirer.prompt([{ type: 'input', name: 'date', message: 'Date (yyyy-MM-dd):' }]);
      date = ans.date;
    }
    const acts = await queryActivities(date);
    if (!acts || acts.length === 0) {
      console.log('  No activities found.');
      return;
    }
    console.log(chalk.bold('\n  Activities:'));
    for (const a of acts) {
      const full = a.fullActivity === '1' ? chalk.red('[Full]') : chalk.green('[Open]');
      const signed = a.signStatus === '1' ? chalk.yellow(' [Joined]') : '';
      console.log(`    ${full} [${a.clubActivityId}] ${a.activityName} | ${a.startTime}-${a.endTime} | ${a.signInStudent}/${a.maxStudent}人${signed}`);
      console.log(`       ${a.addressDetail} | ${a.teacherName}`);
    }
  } else if (action === 'mine') {
    const list = await queryMyActivities();
    if (!list || list.length === 0) {
      console.log('  No joined activities.');
      return;
    }
    console.log(chalk.bold('\n  My Activities:'));
    for (const a of list) {
      const status = a.activityStatus === '3' ? chalk.green('[Done]') : a.activityStatus === '2' ? chalk.yellow('[Ongoing]') : '[Upcoming]';
      console.log(`    ${status} [${a.clubActivityId}] ${a.activityName} | ${a.mmdd} ${a.startTime}-${a.endTime}`);
    }
  } else if (action === 'join') {
    const { actId } = await inquirer.prompt([
      { type: 'input', name: 'actId', message: 'Activity ID to join:' },
    ]);
    if (actId) {
      const result = await joinActivity(parseInt(actId));
      console.log(chalk.green(`  Joined! ${result?.message || JSON.stringify(result) || 'OK'}`));
    }
  } else if (action === 'sign') {
    await autoSignIn();
  }
}

main().catch((e) => {
  console.error(chalk.red(e.message));
  process.exit(1);
});
