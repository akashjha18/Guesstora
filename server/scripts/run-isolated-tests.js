import { spawn } from 'node:child_process';
import { createIsolatedApi, serverDir } from './testSupport.js';

let isolatedApi;
let testExitCode = 1;

try {
  isolatedApi = await createIsolatedApi('test');
  await isolatedApi.stop();

  const testProcess = spawn(process.execPath, ['--test'], {
    cwd: serverDir,
    env: isolatedApi.env,
    stdio: 'inherit',
  });
  const [code, signal] = await new Promise(resolve => {
    testProcess.once('error', error => {
      console.error('Unable to start Node test runner:', error);
      resolve([1, null]);
    });
    testProcess.once('exit', (exitCode, exitSignal) => resolve([exitCode, exitSignal]));
  });
  testExitCode = code ?? (signal ? 1 : 0);
} catch (error) {
  console.error(error);
} finally {
  if (isolatedApi) {
    try {
      await isolatedApi.cleanup();
    } catch (error) {
      console.error('Failed to clean up isolated test database:', error);
      testExitCode = 1;
    }
  }
}

process.exitCode = testExitCode;
