"use client";

import Uppy from "@uppy/core";
// For now, if you do not want to install UI components you
// are not using import from lib directly.
import { useUppyEvent } from "@uppy/react";
import Dashboard from "@uppy/react/lib/Dashboard";
import Tus, { TusBody } from "@uppy/tus";
import { useState } from "react";

import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

type Meta = {
  objectName: string;
  contentType: string;
  name: string;
  filename: string;
};

function createUppy() {
  return new Uppy<Meta, TusBody>({
    restrictions: {
      maxFileSize: 5 * 1024 * 1024, // 5MB,
      maxNumberOfFiles: 1,
      allowedFileTypes: [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    },
  }).use(Tus, {
    endpoint: "/api/upload",
    removeFingerprintOnSuccess: true,
    uploadDataDuringCreation: true,
  });
}

export default function UppyDashboard() {
  // Important: use an initializer function to prevent the state from recreating.
  const [uppy] = useState(createUppy);

  useUppyEvent(uppy, "file-added", (file) => {
    file.meta = {
      ...file.meta,
      objectName: file.name as string,
      contentType: file.type as string,
    };
  });

  return <Dashboard theme="dark" uppy={uppy} />;
}
