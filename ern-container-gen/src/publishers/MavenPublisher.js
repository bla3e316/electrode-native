// @flow
import type {
  ContainerPublisher,
  ContainerPublisherConfig
} from '../FlowTypes'
import {
  MavenUtils,
  shell,
  childProcess
 } from 'ern-core'
import fs from 'fs'
import path from 'path'
import tmp from 'tmp'
const {
  execp
} = childProcess

export default class MavenPublisher implements ContainerPublisher {
  get name (): string {
    return 'maven'
  }

  async publish (config: ContainerPublisherConfig): any {
    if (!config.extra) {
      throw new Error('Missing extra config for Maven Publisher')
    }

    const artifactId = config.extra.artifactId
    const groupId = config.extra.groupId

    const workingDir = tmp.dirSync({ unsafeCleanup: true }).name
    shell.cp('-Rf', path.join(config.containerPath, '{.*,*}'), workingDir)

    if (MavenUtils.isLocalMavenRepo(config.url)) {
      MavenUtils.createLocalMavenDirectoryIfDoesNotExist()
    }

    fs.appendFileSync(path.join(workingDir, 'lib', 'build.gradle'),
  `
  apply plugin: 'maven'
  
  task androidSourcesJar(type: Jar) {
      classifier = 'sources'
      from android.sourceSets.main.java.srcDirs
      include '**/*.java'
  }
  
  artifacts {
      archives androidSourcesJar
  }
  
  uploadArchives {
      repositories {
          mavenDeployer {
              pom.version = '${config.containerVersion}'
              pom.artifactId = '${artifactId}'
              pom.groupId = '${groupId}'
              ${MavenUtils.targetRepositoryGradleStatement(config.url)}
          }
      }
  }
  `)

    try {
      log.debug('[=== Starting build and publication ===]')
      shell.pushd(workingDir)
      await this.buildAndUploadArchive()
      log.debug('[=== Completed build and publication of the module ===]')
    } finally {
      shell.popd()
    }
  }

  async buildAndUploadArchive (): Promise<*> {
    const gradlew = /^win/.test(process.platform) ? 'gradlew' : './gradlew'
    return execp(`${gradlew} lib:uploadArchives`)
  }
}
