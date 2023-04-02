import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'
import * as path from 'path'

function fillTemplate(
  s: string,
  replacements: { [key: string]: string }
): string {
  for (const key in replacements) {
    const r = new RegExp(`\\$\\{${key}\\}`, 'g')
    s = s.replace(r, replacements[key])
  }
  return s
}

async function run(): Promise<void> {
  try {
    const binary = core.getInput('binary')
    const version = core.getInput('version')
    let downloadURL = core.getInput('download_url')
    let tarballBinaryPath = core.getInput('binary_path_in_archive')
    let smokeTest = core.getInput('smoke_test')
    const artifactFormat = core.getInput('artifact_format')

    const replacements = { binary, version }
    downloadURL = fillTemplate(downloadURL, replacements)
    tarballBinaryPath = fillTemplate(tarballBinaryPath, replacements)
    smokeTest = fillTemplate(smokeTest, replacements)

    core.info(`download URL:         ${downloadURL}`)
    core.info(`tarball binary path:  ${tarballBinaryPath}`)
    core.info(`smoke test:           ${smokeTest}`)

    await installTool(
      binary,
      version,
      downloadURL,
      tarballBinaryPath,
      artifactFormat
    )
    await exec.exec(smokeTest)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('Unknown error')
    }
  }
}

function getUncompressor(format: string): (arg0: string) => Promise<string> {
  switch (format) {
    case '.tar.gz':
    case '.gz':
      return tc.extractTar
    case '.7z':
      return tc.extract7z
    case '.zip':
      return tc.extractZip
    default:
      throw new Error(`Unsupported format ${format}`)
  }
}

async function installTool(
  name,
  version,
  url,
  tarballBinaryPath,
  artifactFormat
): Promise<void> {
  let cachedPath = tc.find(name, version)
  if (!cachedPath) {
    const downloadedPath = await tc.downloadTool(url)
    if (artifactFormat === 'auto') {
      artifactFormat = path.extname(url)
    }
    const uncompressor = getUncompressor(artifactFormat)
    const extractedPath = await uncompressor(downloadedPath, name)
    const binaryPath = path.join(extractedPath, tarballBinaryPath)
    cachedPath = await tc.cacheFile(binaryPath, name, name, version)
  }

  core.addPath(cachedPath)
}

run()
