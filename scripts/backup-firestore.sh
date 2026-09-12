#!/usr/bin/env bash
# ==============================================================================
# scripts/backup-firestore.sh
# Standard Managed Cloud Firestore Backup & Restore Utility
# Backed by Google Cloud Storage (gcloud firestore export/import)
#
# Architecture:
#   This utility leverages Google Cloud's native, atomic, high-throughput managed
#   export/import service for Cloud Firestore. Backups are exported directly to a
#   Cloud Storage bucket with uniform bucket-level access and server-side encryption.
#
# Security & IAM Prerequisites:
#   1. Caller Identity:
#      - roles/datastore.importExportAdmin on the target project
#      - roles/storage.admin on the target backup bucket
#   2. Cloud Firestore Service Agent:
#      The Firestore service agent (service-${PROJECT_NUMBER}@gcp-sa-firestore.iam.gserviceaccount.com)
#      must have roles/storage.objectAdmin on the backup bucket.
#   3. Storage Bucket:
#      - Uniform bucket-level access must be enabled.
#      - Public access must be prevented.
#
# Usage:
#   ./scripts/backup-firestore.sh export [OPTIONS]
#   ./scripts/backup-firestore.sh import [OPTIONS] --backup-uri=gs://...
#   ./scripts/backup-firestore.sh list [OPTIONS]
#   ./scripts/backup-firestore.sh status --operation=...
# ==============================================================================

set -euo pipefail

# Default configuration
DEFAULT_PROJECT_ID="${GCLOUD_PROJECT:-${GOOGLE_CLOUD_PROJECT:-mwendo-salama-prod}}"
DEFAULT_COLLECTIONS="users,saccos,vehicles,trips,incident_reports,black_spots,audit_logs,system_health_checks"
PROD_PROJECT_ID="mwendo-salama-prod"

# Help and usage documentation
show_help() {
  cat <<EOF
Mwendo Salama - Cloud Firestore Managed Backup & Restore Utility

COMMANDS:
  export     Initiates a managed Firestore export to Google Cloud Storage.
  import     Initiates a managed Firestore restore from a GCS backup directory.
  list       Lists available backups in the configured Cloud Storage bucket.
  status     Polls the status of a running export or import operation.
  help       Displays this documentation.

OPTIONS:
  --project-id=PROJECT_ID        GCP Project ID (default: ${DEFAULT_PROJECT_ID})
  --bucket=BUCKET_NAME           Target GCS bucket (default: gs://\${PROJECT_ID}-firestore-backups)
  --collections=COLL1,COLL2      Comma-separated collections to export (default: all core collections)
  --backup-uri=gs://...          Source GCS URI prefix for import command (REQUIRED for import)
  --operation=OPERATION_ID       Full operation name to describe (REQUIRED for status)
  --allow-prod-restore           Explicit override required if attempting restore on production
  --async                        Do not wait for export/import operation to complete

EXAMPLES:
  # 1. Export core production collections
  ./scripts/backup-firestore.sh export --project-id=mwendo-salama-prod

  # 2. List available backup snapshots
  ./scripts/backup-firestore.sh list --project-id=mwendo-salama-prod

  # 3. Restore to staging project (drill)
  ./scripts/backup-firestore.sh import \
    --project-id=mwendo-salama-staging \
    --backup-uri=gs://mwendo-salama-prod-firestore-backups/2026-09-12T05-00-00

EOF
}

# Parse command
COMMAND="${1:-help}"
if [[ "$#" -gt 0 ]]; then shift; fi

# Parse options
PROJECT_ID="${DEFAULT_PROJECT_ID}"
BUCKET_NAME=""
COLLECTIONS="${DEFAULT_COLLECTIONS}"
BACKUP_URI=""
OPERATION_NAME=""
ALLOW_PROD_RESTORE=false
ASYNC_MODE=false

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --project-id=*)
      PROJECT_ID="${1#*=}"
      ;;
    --bucket=*)
      BUCKET_NAME="${1#*=}"
      ;;
    --collections=*)
      COLLECTIONS="${1#*=}"
      ;;
    --backup-uri=*)
      BACKUP_URI="${1#*=}"
      ;;
    --operation=*)
      OPERATION_NAME="${1#*=}"
      ;;
    --allow-prod-restore)
      ALLOW_PROD_RESTORE=true
      ;;
    --async)
      ASYNC_MODE=true
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    *)
      echo "ERROR: Unknown option '$1'" >&2
      show_help >&2
      exit 1
      ;;
  esac
  shift
done

# Resolve default bucket if not explicitly provided
if [[ -z "${BUCKET_NAME}" ]]; then
  BUCKET_NAME="gs://${PROJECT_ID}-firestore-backups"
elif [[ ! "${BUCKET_NAME}" =~ ^gs:// ]]; then
  BUCKET_NAME="gs://${BUCKET_NAME}"
fi

# Verification: Ensure gcloud CLI is available
verify_gcloud() {
  if ! command -v gcloud >/dev/null 2>&1; then
    echo "ERROR: Google Cloud CLI ('gcloud') is not installed or not in PATH." >&2
    echo "Please install the Google Cloud SDK or run within the GCP deployment environment." >&2
    exit 1
  fi
}

# ------------------------------------------------------------------------------
# COMMAND: export
# ------------------------------------------------------------------------------
do_export() {
  verify_gcloud

  TIMESTAMP="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
  TARGET_URI="${BUCKET_NAME}/${TIMESTAMP}"

  echo "======================================================================"
  echo "MWENDO SALAMA — FIRESTORE MANAGED EXPORT"
  echo "Project     : ${PROJECT_ID}"
  echo "Destination : ${TARGET_URI}"
  echo "Collections : ${COLLECTIONS}"
  echo "Started At  : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "======================================================================"

  CMD_ARGS=(
    firestore export
    "${TARGET_URI}"
    --project="${PROJECT_ID}"
    --collection-ids="${COLLECTIONS}"
    --format="json"
  )

  if [[ "${ASYNC_MODE}" == "true" ]]; then
    CMD_ARGS+=(--async)
  fi

  echo "Initiating managed export via gcloud..."
  OPERATION_OUTPUT="$(gcloud "${CMD_ARGS[@]}")"
  echo "${OPERATION_OUTPUT}"

  echo "======================================================================"
  echo "Export command dispatched successfully."
  echo "Snapshot URI: ${TARGET_URI}"
  echo "======================================================================"
}

# ------------------------------------------------------------------------------
# COMMAND: import (RESTORE)
# ------------------------------------------------------------------------------
do_import() {
  verify_gcloud

  if [[ -z "${BACKUP_URI}" ]]; then
    echo "ERROR: --backup-uri=gs://... is required for the import command." >&2
    exit 1
  fi

  # CRITICAL SAFETY GUARD: Prevent accidental restore to production
  if [[ "${PROJECT_ID}" == "${PROD_PROJECT_ID}" ]]; then
    if [[ "${ALLOW_PROD_RESTORE}" != "true" ]]; then
      echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >&2
      echo "CRITICAL ERROR: Destructive restore targeted at PRODUCTION (${PROD_PROJECT_ID})." >&2
      echo "Managed import will overwrite existing documents." >&2
      echo "To proceed, you must supply: --allow-prod-restore" >&2
      echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >&2
      exit 1
    fi

    echo "WARNING: Production restore requested. Prompting for manual confirmation..." >&2
    read -r -p "Type 'CONFIRM-PRODUCTION-RESTORE' to proceed: " CONFIRM_INPUT
    if [[ "${CONFIRM_INPUT}" != "CONFIRM-PRODUCTION-RESTORE" ]]; then
      echo "Aborted by user. No restore operation executed." >&2
      exit 1
    fi
  fi

  echo "======================================================================"
  echo "MWENDO SALAMA — FIRESTORE MANAGED RESTORE (IMPORT)"
  echo "Target Project : ${PROJECT_ID}"
  echo "Source Backup  : ${BACKUP_URI}"
  echo "Collections    : ${COLLECTIONS}"
  echo "Started At     : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "======================================================================"

  CMD_ARGS=(
    firestore import
    "${BACKUP_URI}"
    --project="${PROJECT_ID}"
    --collection-ids="${COLLECTIONS}"
    --format="json"
  )

  if [[ "${ASYNC_MODE}" == "true" ]]; then
    CMD_ARGS+=(--async)
  fi

  echo "Initiating managed import via gcloud..."
  OPERATION_OUTPUT="$(gcloud "${CMD_ARGS[@]}")"
  echo "${OPERATION_OUTPUT}"

  echo "======================================================================"
  echo "Managed import dispatched successfully."
  echo "======================================================================"
}

# ------------------------------------------------------------------------------
# COMMAND: list
# ------------------------------------------------------------------------------
do_list() {
  verify_gcloud
  echo "Listing backups in ${BUCKET_NAME}..."
  if command -v gsutil >/dev/null 2>&1; then
    gsutil ls "${BUCKET_NAME}/"
  else
    gcloud storage ls "${BUCKET_NAME}/"
  fi
}

# ------------------------------------------------------------------------------
# COMMAND: status
# ------------------------------------------------------------------------------
do_status() {
  verify_gcloud
  if [[ -z "${OPERATION_NAME}" ]]; then
    echo "ERROR: --operation=OPERATION_NAME is required." >&2
    exit 1
  fi
  gcloud firestore operations describe "${OPERATION_NAME}" --project="${PROJECT_ID}"
}

# ------------------------------------------------------------------------------
# Dispatch
# ------------------------------------------------------------------------------
case "${COMMAND}" in
  export)
    do_export
    ;;
  import)
    do_import
    ;;
  list)
    do_list
    ;;
  status)
    do_status
    ;;
  help)
    show_help
    ;;
  *)
    echo "ERROR: Unknown command '${COMMAND}'" >&2
    show_help >&2
    exit 1
    ;;
esac
