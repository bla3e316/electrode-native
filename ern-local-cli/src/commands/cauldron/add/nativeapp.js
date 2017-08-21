// @flow

import {
  Dependency,
  NativeApplicationDescriptor,
  spin
} from 'ern-util'
import {
  cauldron
} from 'ern-core'
import inquirer from 'inquirer'
import _ from 'lodash'
import utils from '../../../lib/utils'

exports.command = 'nativeapp <completeNapDescriptor> [platformVersion]'
exports.desc = 'Add a native application to the cauldron'

exports.builder = function (yargs: any) {
  return yargs
  .option('platformVersion', {
    alias: 'v',
    describe: 'Platform version'
  })
  .option('copyPreviousVersionData', {
    alias: 'c',
    describe: 'Copy previous version data',
    type: 'boolean'
  })
}

exports.handler = async function ({
  completeNapDescriptor,
  platformVersion,
  copyPreviousVersionData
} : {
  completeNapDescriptor: string,
  platformVersion?: string,
  copyPreviousVersionData?: boolean
}) {
  await utils.logErrorAndExitIfNotSatisfied({
    isCompleteNapDescriptorString: completeNapDescriptor
  })

  const napDescriptor = NativeApplicationDescriptor.fromString(completeNapDescriptor)

  try {
    await cauldron.beginTransaction()

    const previousApps = await cauldron.getNativeApp(new NativeApplicationDescriptor(napDescriptor.name, napDescriptor.platform))

    await spin(`Adding ${completeNapDescriptor}`, cauldron.addNativeApp(napDescriptor, platformVersion
      ? platformVersion.toString().replace('v', '')
      : undefined))

    if (previousApps && (copyPreviousVersionData || await askUserCopyPreviousVersionData())) {
      await spin(`Copying data over from previous version`, copyOverPreviousVersionData(napDescriptor, previousApps))
    }

    await spin(`Updating Cauldron`, cauldron.commitTransaction())
    log.info(`${napDescriptor.toString()} was succesfuly added to the Cauldron`)
  } catch (e) {
    log.error(`An error occured while trying to add the native app to the Cauldron: ${e.message}`)
    await cauldron.discardTransaction()
  }
}

async function copyOverPreviousVersionData (napDescriptor: NativeApplicationDescriptor, previousApps: any) {
  const previousNativeAppVersion = _.last(previousApps.versions)
  // Copy over previous native application version native dependencies
  for (const nativeDep of previousNativeAppVersion.nativeDeps) {
    await cauldron.addNativeDependency(napDescriptor, Dependency.fromString(nativeDep))
  }
  // Copy over previous native application version container MiniApps
  for (const containerMiniApp of previousNativeAppVersion.miniApps.container) {
    await cauldron.addContainerMiniApp(napDescriptor, Dependency.fromString(containerMiniApp))
  }
  // Copy over previous yarn lock if any
  if (previousNativeAppVersion.yarnlock) {
    await cauldron.setYarnLockId(napDescriptor, previousNativeAppVersion.yarnlock)
  }
  // Copy over container version
  if (previousNativeAppVersion.containerVersion) {
    await cauldron.updateContainerVersion(napDescriptor, previousNativeAppVersion.containerVersion)
  } else {
    // Backward compatibility. REMOVE IN ERN 0.5.0
    const containerVersion = await cauldron.getContainerVersion(napDescriptor)
    await cauldron.updateContainerVersion(napDescriptor, containerVersion)
  }
}

async function askUserCopyPreviousVersionData () {
  const { userCopyPreviousVersionData } = await inquirer.prompt({
    type: 'confirm',
    name: 'userCopyPreviousVersionData',
    message: 'Do you want to copy data from previous version ?'
  })

  return userCopyPreviousVersionData
}
