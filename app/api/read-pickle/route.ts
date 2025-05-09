import { type NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { writeFile, readFile } from "fs/promises"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"
import { mkdir } from "fs/promises"

// Ensure temp directory exists
const ensureTempDir = async () => {
  const tempDir = join(process.cwd(), "tmp")
  try {
    await mkdir(tempDir, { recursive: true })
    return tempDir
  } catch (error) {
    console.error("Error creating temp directory:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check if it's a pickle file
    if (!file.name.endsWith(".pkl") && !file.name.endsWith(".pickle")) {
      return NextResponse.json({ error: "File must be a pickle file" }, { status: 400 })
    }

    // Create a unique filename
    const tempDir = await ensureTempDir()
    const fileId = uuidv4()
    const filePath = join(tempDir, `${fileId}.pkl`)
    const outputPath = join(tempDir, `${fileId}.json`)

    // Save the file
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    // Create a Python script to convert pickle to JSON
    const scriptPath = join(tempDir, `${fileId}.py`)
    const scriptContent = `
import pickle
import json
import sys

try:
    with open('${filePath.replace(/\\/g, "\\\\")}', 'rb') as f:
        data = pickle.load(f)
    
    # Handle numpy arrays or other special types
    def convert(obj):
        if hasattr(obj, 'tolist'):
            return obj.tolist()
        raise TypeError(f"Type {type(obj)} not serializable")
    
    with open('${outputPath.replace(/\\/g, "\\\\")}', 'w') as f:
        json.dump(data, f, default=convert)
    
    print("Conversion successful")
except Exception as e:
    print(f"Error: {str(e)}")
    sys.exit(1)
`
    await writeFile(scriptPath, scriptContent)

    // Execute the Python script
    await new Promise<void>((resolve, reject) => {
      exec(`python ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Execution error: ${error}`)
          console.error(`stderr: ${stderr}`)
          reject(error)
          return
        }
        console.log(`stdout: ${stdout}`)
        resolve()
      })
    })

    // Read the JSON output
    const jsonData = await readFile(outputPath, "utf8")

    // Clean up temporary files
    // Note: In production, you might want to use a more robust cleanup mechanism
    exec(`rm ${filePath} ${scriptPath} ${outputPath}`)

    return NextResponse.json({ data: JSON.parse(jsonData) })
  } catch (error) {
    console.error("Error processing pickle file:", error)
    return NextResponse.json({ error: "Failed to process pickle file" }, { status: 500 })
  }
}
