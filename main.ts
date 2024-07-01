import { App, Chart } from 'cdk8s';
import { ChartProps } from 'cdk8s/lib/chart';
import { Construct } from 'constructs';
// @ts-ignore
import {
  ParameterBuilder,
  PipelineBuilder,
  PipelineRunBuilder,
  TaskBuilder,
  WorkspaceBuilder,
  fromPipelineParam,
} from '../src';

class PipelineRunTest extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const pipelineParam = new ParameterBuilder('repo-url')
      .withDefaultValue('');

    const myTask = new TaskBuilder(this, 'git-clone')
      .withName('fetch-source')
      .withWorkspace(new WorkspaceBuilder('output')
        .withBinding('shared-data')
        .withDescription('The files cloned by the task'))
      .withStringParam(new ParameterBuilder('url').withValue(fromPipelineParam(pipelineParam)));

    const pipeline = new PipelineBuilder(this, 'clone-build-push')
      .withDescription('This pipeline closes a repository')
      .withTask(myTask)
      .withStringParam(pipelineParam);
    pipeline.buildPipeline({ includeDependencies: true });

    new PipelineRunBuilder(this, 'my-pipeline-run', pipeline)
      .withRunParam('repo-url', 'https://github.com/exmaple/my-repo')
      .withWorkspace('shared-data', 'dataPVC', 'my-shared-data')
      .buildPipelineRun({ includeDependencies: true });
  }
}

const app = new App();
new PipelineRunTest(app, 'test-pipeline-run');
app.synth();
