import { S3Store } from "@tus/s3-store";
import { Server } from "@tus/server";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { z } from "zod/v4";

const s3Store = new S3Store({
  partSize: 8 * 1024 * 1024, // Each uploaded part will have ~8MiB,
  s3ClientConfig: {
    forcePathStyle: true,
    bucket: process.env.AWS_BUCKET!,
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  },
});

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
