import { S3Store } from "@tus/s3-store";
import { Server } from "@tus/server";
import { randomBytes, createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod/v4";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";

const s3ClientConfig = {
  forcePathStyle: true,
  bucket: process.env.AWS_BUCKET ?? "test",
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
};

const s3Store = new S3Store({
  partSize: 1024,
  s3ClientConfig,
});

const s3Client = new S3Client(s3ClientConfig);

async function computeChecksum(data: Buffer): Promise<string> {
  return createHash("sha256").update(data).digest("hex");
}

async function downloadFileFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: s3ClientConfig.bucket,
    Key: key,
  });
  const response = await s3Client.send(command);
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function verifyFileIntegrity(
  fileKey: string,
  infoKey: string,
  metadata: any
) {
  try {
    // Download the uploaded file from S3
    const uploadedFile = await downloadFileFromS3(fileKey);
    const uploadedChecksum = await computeChecksum(uploadedFile);

    // Download and parse the TUS info file
    const infoFile = await downloadFileFromS3(infoKey);
    const infoData = JSON.parse(infoFile.toString("utf-8"));

    // Try to find and read the original test file for comparison
    let originalChecksum: string | null = null;
    const originalFileName = metadata?.objectName;
    if (originalFileName) {
      try {
        const testFilePath = path.join(
          process.cwd(),
          "test-fixtures",
          originalFileName
        );
        const originalFile = await readFile(testFilePath);
        originalChecksum = await computeChecksum(originalFile);
      } catch (err) {
        console.log(`⚠ Could not read original file for comparison`);
      }
    }

    // Log comparison
    console.log(`\n=== CHECKSUM VERIFICATION ===`);
    console.log(`File: ${fileKey}`);
    console.log(`Original filename: ${originalFileName}`);
    if (originalChecksum) {
      console.log(`Original file checksum:  ${originalChecksum}`);
    }
    console.log(`Uploaded file checksum:  ${uploadedChecksum}`);
    if (originalChecksum) {
      console.log(
        `Checksum match: ${
          originalChecksum === uploadedChecksum
            ? "✓ YES"
            : "✗ NO - FILE CORRUPTED!"
        }`
      );
    }
    console.log(`\nActual file size: ${uploadedFile.length} bytes`);
    console.log(`TUS reported size: ${infoData.size} bytes`);
    console.log(
      `Size match: ${uploadedFile.length === infoData.size ? "✓ YES" : "✗ NO"}`
    );
    console.log(`=============================\n`);

    return { uploadedChecksum, originalChecksum, uploadedFile, infoData };
  } catch (error) {
    console.error("Error during file integrity verification:", error);
    throw error;
  }
}

const metadataSchema = z.object({
  objectName: z.string().min(1),
  type: z.string().min(1),
  contentType: z.string().min(1),
  name: z.string().min(1),
});

type Metadata = z.infer<typeof metadataSchema>;

const server = new Server({
  path: "/api/upload",
  datastore: s3Store,
  async onUploadFinish(_, upload) {
    console.log("Upload finished:", upload);

    // Verify file integrity
    const fileKey = upload.storage?.path;
    const infoKey = `${fileKey}.info`;

    if (fileKey) {
      await verifyFileIntegrity(fileKey, infoKey, upload.metadata);
    }

    return { status_code: 201 };
  },
  async onUploadCreate(_req, metadata) {
    const result = metadataSchema.safeParse(metadata.metadata);
    if (!result.success) {
      throw { status_code: 400, body: "invalid metadata" };
    }
    return {
      metadata: result.data,
    };
  },
  async namingFunction(_req, uploadedFileMetadata) {
    const metadata = uploadedFileMetadata as Metadata;

    const fileExtension = path.extname(metadata.objectName);
    const fileName = path.basename(metadata.objectName, fileExtension);
    const randomString = randomBytes(16).toString("hex");
    const parsedFilename = `file-${randomString}-${fileName}`;

    const filenameToSave = `debug/${parsedFilename}${fileExtension}`;

    return filenameToSave;
  },
  generateUrl(_req, { proto, host, path, id }) {
    id = Buffer.from(id, "utf-8").toString("base64url");
    return `${proto}://${host}${path}/${id}`;
  },
  getFileIdFromRequest(_req, lastPath) {
    return Buffer.from(lastPath as string, "base64url").toString("utf-8");
  },
});

export function GET(req: Request) {
  return server.handleWeb(req);
}
export function POST(req: Request) {
  return server.handleWeb(req);
}
export function PATCH(req: Request) {
  return server.handleWeb(req);
}
export function DELETE(req: Request) {
  return server.handleWeb(req);
}
export function OPTIONS(req: Request) {
  return server.handleWeb(req);
}
export function HEAD(req: Request) {
  return server.handleWeb(req);
}
