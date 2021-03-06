// @flow

import {
  CauldronHelper,
  Dependency,
  NativeApplicationDescriptor,
  spin,
  utils as coreUtils
} from 'ern-core'
import inquirer from 'inquirer'
import _ from 'lodash'
import utils from '../../../lib/utils'

exports.command = 'nativeapp <descriptor>'
exports.desc = 'Add a native application to the cauldron'

exports.builder = function (yargs: any) {
  return yargs
  .option('platformVersion', {
    alias: 'v',
    describe: 'Use specified platform version'
  })
  .option('copyFromVersion', {
    alias: 'c',
    describe: 'Copy Cauldron data from a previous native application version',
    type: 'string'
  })
  .epilog(utils.epilog(exports))
}

exports.handler = async function ({
  descriptor,
  platformVersion,
  copyFromVersion
} : {
  descriptor: string,
  platformVersion?: string,
  copyFromVersion?: string
}) {
  await utils.logErrorAndExitIfNotSatisfied({
    cauldronIsActive: {
      extraErrorMessage: 'A Cauldron must be active in order to use this command'
    },
    isCompleteNapDescriptorString: { descriptor },
    napDescritorDoesNotExistsInCauldron: {
      descriptor,
      extraErrorMessage: 'This version of the native application already exist in Cauldron.'
    }
  })

  const napDescriptor = NativeApplicationDescriptor.fromString(descriptor)

  try {
    var cauldron = await coreUtils.getCauldronInstance()
    await cauldron.beginTransaction()

    const previousApps = await cauldron.getNativeApp(new NativeApplicationDescriptor(napDescriptor.name, napDescriptor.platform))

    await spin(`Adding ${descriptor}`, cauldron.addNativeApp(napDescriptor, platformVersion
      ? platformVersion.toString().replace('v', '')
      : undefined))

    if (previousApps) {
      const latestVersion = _.last(previousApps.versions)
      const latestVersionName = latestVersion.name

      if (copyFromVersion) {
        if (copyFromVersion === 'latest') {
          await spin(`Copying data over from latest version ${latestVersionName}`, copyOverPreviousVersionData(napDescriptor, latestVersion, cauldron))
        } else {
          const version = _.find(previousApps.versions, v => v.name === copyFromVersion)
          if (!version) {
            throw new Error(`Could not resolve native application version to copy Cauldron data from.\nExamine current value : ${copyFromVersion}`)
          }
          await spin(`Copying data over from version ${copyFromVersion}`, copyOverPreviousVersionData(napDescriptor, version, cauldron))
        }
      } else if (await askUserCopyPreviousVersionData(latestVersionName)) {
        await spin(`Copying data over from previous version`, copyOverPreviousVersionData(napDescriptor, latestVersion, cauldron))
      }
    }

    await spin(`Updating Cauldron`, cauldron.commitTransaction(`Add ${napDescriptor.toString()} native application`))
    log.info(`${napDescriptor.toString()} was succesfuly added to the Cauldron`)
  } catch (e) {
    if (cauldron) {
      await cauldron.discardTransaction()
    }
    coreUtils.logErrorAndExitProcess(e)
  }
}

async function copyOverPreviousVersionData (
  napDescriptor: NativeApplicationDescriptor,
  nativeAppVersion: any,
  cauldron: CauldronHelper) {
  // Copy over previous native application version native dependencies
  for (const nativeDep of nativeAppVersion.nativeDeps) {
    await cauldron.addNativeDependency(napDescriptor, Dependency.fromString(nativeDep))
  }
  // Copy over previous native application version container MiniApps
  for (const containerMiniApp of nativeAppVersion.miniApps.container) {
    await cauldron.addContainerMiniApp(napDescriptor, Dependency.fromString(containerMiniApp))
  }
  // Copy over previous yarn lock if any
  if (nativeAppVersion.yarnLocks) {
    await cauldron.setYarnLocks(napDescriptor, nativeAppVersion.yarnLocks)
  }
  // Copy over container version
  if (nativeAppVersion.containerVersion) {
    await cauldron.updateContainerVersion(napDescriptor, nativeAppVersion.containerVersion)
  }
}

async function askUserCopyPreviousVersionData (version: string) : Promise<string> {
  const { userCopyPreviousVersionData } = await inquirer.prompt({
    type: 'confirm',
    name: 'userCopyPreviousVersionData',
    message: `Do you want to copy data from the previous version (${version}) ?`
  })

  return userCopyPreviousVersionData
}
