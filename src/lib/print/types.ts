export type PrintJobStatus = 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface PrintJob {
  jobId: string;
  userId: string;
  fileName: string;
  fileReference: string;
  fileSizeBytes: number;
  submissionTimestamp: string;
  status: PrintJobStatus;
  finalResult: string | null;
  errorInfo: string | null;
  provider: string;
  providerJobId: string | null;
  acknowledged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CloudPrintResult {
  providerJobId: string;
  status: PrintJobStatus;
  provider: string;
  message?: string;
  error?: string;
  isVerifiable: boolean;
}

export interface CloudPrintStatusCheck {
  status: PrintJobStatus;
  finalResult: string | null;
  errorInfo: string | null;
  isVerifiable: boolean;
}
