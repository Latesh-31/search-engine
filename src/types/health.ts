export type HealthStatus = 'pass' | 'fail' | 'warn' | 'skipped';

export interface ComponentHealth {
  componentId: string;
  componentType: 'app' | 'datastore' | 'search' | 'cache' | 'queue';
  status: HealthStatus;
  time: string;
  observedValue?: number;
  observedUnit?: 'ms';
  output?: string;
}
