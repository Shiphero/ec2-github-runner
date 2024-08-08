const AWS = require('aws-sdk');
const core = require('@actions/core');
const config = require('./config');

// User data scripts are run as the root user
function buildUserDataScript(githubRegistrationToken, label) {
  if (config.input.runnerHomeDir) {
    // If runner home directory is specified, we expect the actions-runner software (and dependencies)
    // to be pre-installed in the AMI, so we simply cd into that directory and then start the runner
    return [
      '#!/bin/bash',
      `cd "${config.input.runnerHomeDir}"`,
      `echo "${config.input.preRunnerScript}" > pre-runner-script.sh`,
      'source pre-runner-script.sh',
      'export RUNNER_ALLOW_RUNASROOT=1',
      'export ACTIONS_RUNNER_INPUT_REPLACE=true',
      `./config.sh --url https://github.com/${config.githubContext.owner}/${config.githubContext.repo} --token ${githubRegistrationToken} --labels ${label} --replace --ephemeral`,
      './run.sh',
    ];
  } else {
    return [
      '#!/bin/bash',
      'mkdir actions-runner && cd actions-runner',
      `echo "${config.input.preRunnerScript}" > pre-runner-script.sh`,
      'source pre-runner-script.sh',
      'case $(uname -m) in aarch64) ARCH="arm64" ;; amd64|x86_64) ARCH="x64" ;; esac && export RUNNER_ARCH=${ARCH}',
      'curl -O -L https://github.com/actions/runner/releases/download/v2.313.0/actions-runner-linux-${RUNNER_ARCH}-2.313.0.tar.gz',
      'tar xzf ./actions-runner-linux-${RUNNER_ARCH}-2.313.0.tar.gz',
      'export RUNNER_ALLOW_RUNASROOT=1',
      'export ACTIONS_RUNNER_INPUT_REPLACE=true',
      `./config.sh --url https://github.com/${config.githubContext.owner}/${config.githubContext.repo} --token ${githubRegistrationToken} --labels ${label} --replace --ephemeral`,
      './run.sh',
    ];
  }
}

function shuffle(array) {
  // Fisher-Yates
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function startEc2Instances(label, githubRegistrationToken) {
  const ec2 = new AWS.EC2();

  const userData = buildUserDataScript(githubRegistrationToken, label);

  let parsedSubnetId;
  try {
    parsedSubnetId = JSON.parse(config.input.subnetId);
  } catch (error) {
    parsedSubnetId = config.input.subnetId;
  }
  const subnetIds = Array.isArray(parsedSubnetId) ? shuffle(parsedSubnetId) : [parsedSubnetId];

  for (const subnetId of subnetIds) {
    const params = {
      ImageId: config.input.ec2ImageId,
      InstanceType: config.input.ec2InstanceType,
      MinCount: config.input.ec2InstanceCount,
      MaxCount: config.input.ec2InstanceCount,
      UserData: Buffer.from(userData.join('\n')).toString('base64'),
      SubnetId: subnetId,
      SecurityGroupIds: [config.input.securityGroupId],
      IamInstanceProfile: { Name: config.input.iamRoleName },
      TagSpecifications: config.tagSpecifications,
    };

    try {
      const result = await ec2.runInstances(params).promise();
      const ec2InstanceIds = result.Instances.map((ins) => ins.InstanceId);
      for (const id of ec2InstanceIds) {
        core.info(`AWS EC2 instance ${id} is started using subnetId ${subnetId}`);
      }
      return ec2InstanceIds;
    } catch (error) {
      core.info(`Attempt to start AWS EC2 instance using subnetId ${subnetId} failed: ${error.message}`);
    }
  }

  throw new Error('Failed to start EC2 instance with all provided subnetIds');
}

async function terminateEc2Instance(ec2InstanceId) {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [ec2InstanceId],
  };

  try {
    await ec2.terminateInstances(params).promise();
    core.info(`AWS EC2 instance ${ec2InstanceId} is terminated`);
    return;
  } catch (error) {
    core.error(`AWS EC2 instance ${ec2InstanceId} termination error`);
    throw error;
  }
}

async function waitForInstanceRunning(ec2InstanceId) {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [ec2InstanceId],
  };

  try {
    await ec2.waitFor('instanceRunning', params).promise();
    core.info(`AWS EC2 instance ${ec2InstanceId} is up and running`);
    return;
  } catch (error) {
    core.error(`AWS EC2 instance ${ec2InstanceId} initialization error`);
    throw error;
  }
}

module.exports = {
  startEc2Instances,
  terminateEc2Instance,
  waitForInstanceRunning,
};
