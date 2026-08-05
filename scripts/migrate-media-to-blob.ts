import path from "path"
import fs from "fs"
import dotenv from "dotenv"
import { put } from "@vercel/blob"

dotenv.config({ path: path.resolve(process.cwd(), ".env") })

const token = process.env.BLOB_READ_WRITE_TOKEN

if (!token) {
  console.log("BLOB_READ_WRITE_TOKEN is not set. Aborting.")
  process.exit(1)
}

const { default: config } = await import("../src/payload.config")
const { getPayload } = await import("payload")

async function migrate() {
  const payload = await getPayload({ config })

  const mediaDir = path.resolve(process.cwd(), "media")

  const all = await payload.find({
    collection: "media",
    limit: 0,
    pagination: false,
  })

  console.log("Total media docs:", all.totalDocs)

  let migrated = 0
  let missing = 0
  let failed = 0

  for (const doc of all.docs as any[]) {
    const filePath = path.join(mediaDir, doc.filename)

    if (!fs.existsSync(filePath)) {
      console.log("MISSING LOCAL FILE:", doc.filename)
      missing++
      continue
    }

    try {
      const buffer = fs.readFileSync(filePath)

      await put(doc.filename, buffer, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: doc.mimeType || undefined,
        token,
      })

      migrated++
      if (migrated % 25 === 0) {
        console.log(`Migrated ${migrated}/${all.totalDocs}...`)
      }
    } catch (error) {
      console.log("FAILED:", doc.filename, error instanceof Error ? error.message : error)
      failed++
    }
  }

  console.log("\n======================")
  console.log("Migrated:", migrated)
  console.log("Missing local file:", missing)
  console.log("Failed:", failed)

  process.exit()
}

migrate()
