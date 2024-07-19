import { App, Chart, Size } from 'cdk8s';
import { ChartProps } from 'cdk8s/lib/chart';
import { PersistentVolumeClaim, PersistentVolumeClaimProps, PersistentVolumeAccessMode } from 'cdk8s-plus-27';
import { Construct } from 'constructs';
// @ts-ignore
import {
  ParameterBuilder,
  PipelineBuilder,
  PipelineRunBuilder,
  TaskBuilder,
  TaskStepBuilder,
  WorkspaceBuilder,
  fromPipelineParam,
} from '../src';

class PipelineRunTest extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const pipelineParam = new ParameterBuilder('repo-url')
      .withDefaultValue('');

    const myTask = new TaskBuilder(this, 'clone-git')
      .specifyRunAfter([])
      .withName('fetch-source')
      .withWorkspace(new WorkspaceBuilder('output')
        .withBinding('shared-data')
        .withDescription('The files cloned by the task'))
      .withStringParam(new ParameterBuilder('url').withValue(fromPipelineParam(pipelineParam)))
      .withResult('status', 'Status of the task')
      .withStep(new TaskStepBuilder()
        .withName('step')
        .withImage('ubuntu')
        .fromScriptData('#!/usr/bin/env bash\necho $(params.url)\necho Again!'));
    const myTask2 = new TaskBuilder(this, 'task-two')
      .specifyRunAfter(['fetch-source'])
      .withStep(new TaskStepBuilder()
        .withName('echo')
        .withImage('ubuntu')
        .fromScriptData('#!/usr/bin/env bash\necho Check if these logs print after'));

    const pvcProps : PersistentVolumeClaimProps = { metadata: { name: 'datapvc' }, accessModes: [PersistentVolumeAccessMode.READ_WRITE_ONCE], storage: Size.gibibytes(1) };
    new PersistentVolumeClaim(this, 'datapvc', pvcProps);

    const pipeline = new PipelineBuilder(this, 'clone-build-push')
      .withDescription('This pipeline closes a repository')
      .withTask(myTask)
      .withTask(myTask2)
      .withStringParam(pipelineParam);
    pipeline.buildPipeline({ includeDependencies: true });

    new PipelineRunBuilder(this, 'my-pipeline-run', pipeline)
      .withRunParam('repo-url', 'https://github.com/exmaple/my-repo')
      .withWorkspace('shared-data', 'datapvc', 'my-shared-data')
      .buildPipelineRun({ includeDependencies: true });
  }
}

class PipelineTestWithResolver extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const myWorkspace = new WorkspaceBuilder('output')
      .withDescription('The files cloned by the task')
      .withBinding('shared-data');

    const pipelineParam = new ParameterBuilder('repo-url')
      .withDefaultValue('');

    const urlParam = new ParameterBuilder('url')
      .withValue(fromPipelineParam(pipelineParam));

    const resolver = new ClusterTaskResolver('git-clone', 'default');

    const myTask = new TaskBuilder(this, 'fetch-source')
      .referencingTask(resolver)
      .withWorkspace(myWorkspace)
      .withStringParam(urlParam)
    ;

    new PipelineBuilder(this, 'clone-build-push')
      .withDescription('This pipeline closes a repository, builds a Docker image, etc.')
      .withTask(myTask)
      .withStringParam(pipelineParam)
      .buildPipeline({ includeDependencies: true });
  }
}

const app = new App();
// new PipelineRunTest(app, 'test-pipeline-run');
new PipelineTestWithResolver(app, 'pipeline-with-resolver');
app.synth();
