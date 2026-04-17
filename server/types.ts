// Shapes returned by the Brev catalog API.
// Endpoint: GET https://brevapi2.us-west-2-prod.control-plane.brev.dev/api/instances/alltypesavailable/{orgId}

export type BrevPrice = {
  currency: string; // "USD"
  amount: string;   // decimal as string, e.g. "0.845421"
};

export type BrevGpu = {
  count: number;
  memory: string;       // e.g. "24GiB"
  manufacturer: string; // e.g. "NVIDIA"
  name: string;         // e.g. "L4", sometimes "nvidia-h100-80gb"
  memory_bytes?: { value: number; unit: string };
};

export type BrevInstanceType = {
  type: string;            // e.g. "g2-standard-4:nvidia-l4:1"
  provider: string;        // gcp, aws, lambda-labs, crusoe, nebius, shadeform, launchpad, sfcompute
  location: string;        // e.g. "us-east4"
  sub_location?: string;   // e.g. "us-east4-a"
  is_available: boolean;
  memory: string;          // e.g. "16GiB"
  vcpu: number;
  base_price: BrevPrice;
  supported_gpus: BrevGpu[];
};

export type BrevAllTypesResponse = {
  allInstanceTypes: BrevInstanceType[];
};

// Our normalized DB row.
export type InstanceRow = {
  type: string;
  provider: string;
  location: string;
  sub_location: string;
  gpu_name: string;
  gpu_count: number;
  gpu_memory_gib: number;
  vcpu: number;
  memory_gib: number;
  price_usd_per_hr: number;
  is_available: number; // 0/1
};

export type SnapshotRow = {
  id: number;
  fetched_at: number;
  instance_count: number;
  duration_ms: number;
  ok: number;
  error: string | null;
};
