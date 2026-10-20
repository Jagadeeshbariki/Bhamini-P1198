const fs = require("fs");
const path = require("path");

let server = fs.readFileSync("/server.ts", "utf8");

const startComment = "  // ============================================================================\n  // BENEFICIARY ACKNOWLEDGEMENT & TRACKING API ROUTES";
const endComment = "  // API 404 Handler (prevent falling through to HTML)";

const startIndex = server.indexOf(startComment);
const endIndex = server.indexOf(endComment);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find routes in server.ts");
  process.exit(1);
}

const newRoutes = `  // ============================================================================
  // BENEFICIARY ACKNOWLEDGEMENT & TRACKING API ROUTES (WITH UUID & DRIVE UPLOAD)
  // ============================================================================
  const ACKS_FILE_PATH = path.join(process.cwd(), "data", "acknowledgements.json");
  const memoryAcknowledgements: any[] = [];
  let ackCounter = 1001;

  // Load existing acknowledgements from file
  try {
    if (fs.existsSync(ACKS_FILE_PATH)) {
      const saved = JSON.parse(fs.readFileSync(ACKS_FILE_PATH, "utf8"));
      if (Array.isArray(saved)) {
        memoryAcknowledgements.push(...saved);
        ackCounter = Math.max(ackCounter, 1000 + memoryAcknowledgements.length + 1);
        console.log("[ACKS] Loaded " + memoryAcknowledgements.length + " saved acknowledgement records.");
      }
    }
  } catch (err) {
    console.error("[ACKS] Error loading saved acknowledgements:", err.message);
  }

  function saveAcknowledgementsToFile() {
    try {
      if (!fs.existsSync(path.join(process.cwd(), "data"))) {
        fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
      }
      fs.writeFileSync(ACKS_FILE_PATH, JSON.stringify(memoryAcknowledgements, null, 2), "utf8");
    } catch (e) {
      console.error("[ACKS] Failed to persist acknowledgements:", e.message);
    }
  }

  app.get("/api/acknowledgements/list", (req, res) => {
    res.json({ success: true, acknowledgements: memoryAcknowledgements });
  });

  app.post("/api/acknowledgements/generate", (req, res) => {
    const { activityUuid, beneficiaryId, farmerId, householdId, activityName, beneficiaryName, cluster, gp, village, remarks } = req.body;
    if (!activityUuid && !beneficiaryId && !farmerId) {
      return res.status(400).json({ error: "Missing activityUuid or beneficiaryId" });
    }

    let existing = memoryAcknowledgements.find(a => 
      (activityUuid && a.activity_uuid === activityUuid) ||
      (beneficiaryId && a.beneficiary_id === beneficiaryId) ||
      (farmerId && (a.farmer_id === farmerId || a.household_id === farmerId))
    );

    if (existing) {
      return res.json({ success: true, acknowledgement: existing, message: "Acknowledgement already exists" });
    }

    const ackNum = "P1198-BHM-2026-" + String(ackCounter++).padStart(6, "0");
    const newRecord = {
      id: "ack_" + Math.random().toString(36).substring(2, 11),
      acknowledgement_number: ackNum,
      activity_uuid: activityUuid || "",
      beneficiary_id: beneficiaryId || "",
      household_id: householdId || farmerId || "",
      farmer_id: farmerId || householdId || "",
      activity_name: activityName || "NS",
      beneficiary_name: beneficiaryName || "Beneficiary",
      cluster: cluster || "Cluster 1",
      gp: gp || "GP",
      village: village || "Village",
      generation_status: "GENERATED",
      pdf_storage_path: "/acknowledgements/" + ackNum + ".pdf",
      pdf_version: 1,
      hard_copy_received: "PENDING",
      hard_copy_status: "PENDING",
      received_date: null,
      received_by: null,
      soft_copy_url: null,
      local_backup_url: null,
      photography_consent: "NOT_RECORDED",
      remarks: remarks || "Generated successfully",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memoryAcknowledgements.unshift(newRecord);
    saveAcknowledgementsToFile();
    res.json({ success: true, acknowledgement: newRecord });
  });

  app.post("/api/acknowledgements/hardcopy", (req, res) => {
    const { activityUuid, id, status, receivedBy, receivedDate, remarks, softCopyUrl, householdId, beneficiaryId, beneficiaryName, activityName, cluster, gp, village } = req.body;
    const lookupKey = activityUuid || id;
    if (!lookupKey) {
      return res.status(400).json({ error: "Missing activityUuid or id for record matching" });
    }

    let record = memoryAcknowledgements.find(a => 
      (activityUuid && a.activity_uuid === activityUuid) ||
      (id && (a.id === id || a.acknowledgement_number === id))
    );

    const isReceived = String(status).toUpperCase() === "YES" || String(status).toUpperCase() === "RECEIVED";

    if (!record) {
      const ackNum = "P1198-BHM-2026-" + String(ackCounter++).padStart(6, "0");
      record = {
        id: "ack_" + Math.random().toString(36).substring(2, 11),
        acknowledgement_number: ackNum,
        activity_uuid: activityUuid || id,
        beneficiary_id: beneficiaryId || "",
        household_id: householdId || "",
        farmer_id: householdId || "",
        activity_name: activityName || "NS",
        beneficiary_name: beneficiaryName || "Beneficiary",
        cluster: cluster || "",
        gp: gp || "",
        village: village || "",
        generation_status: "GENERATED",
        pdf_storage_path: "/acknowledgements/" + ackNum + ".pdf",
        pdf_version: 1,
        hard_copy_received: isReceived ? "YES" : "PENDING",
        hard_copy_status: isReceived ? "YES" : "PENDING",
        received_date: isReceived ? (receivedDate || new Date().toISOString()) : null,
        received_by: isReceived ? (receivedBy || "Office Staff") : null,
        soft_copy_url: softCopyUrl || null,
        local_backup_url: null,
        photography_consent: "NOT_RECORDED",
        remarks: remarks || "Updated via office tracking",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryAcknowledgements.unshift(record);
    } else {
      record.hard_copy_received = isReceived ? "YES" : "PENDING";
      record.hard_copy_status = isReceived ? "YES" : "PENDING";
      record.received_date = isReceived ? (receivedDate || new Date().toISOString()) : null;
      record.received_by = isReceived ? (receivedBy || "Office Staff") : null;
      if (softCopyUrl) record.soft_copy_url = softCopyUrl;
      if (remarks) record.remarks = remarks;
      record.updated_at = new Date().toISOString();
    }

    saveAcknowledgementsToFile();
    res.json({ success: true, acknowledgement: record });
  });

  // UPLOAD SCANNED COPY (DRIVE + LOCAL BACKUP + UUID MATCHING)
  app.post("/api/acknowledgements/upload-scanned-copy", async (req, res) => {
    try {
      const { 
        activityUuid, 
        fileName, 
        fileType, 
        fileData, 
        householdId, 
        beneficiaryId, 
        beneficiaryName, 
        activityName, 
        cluster, 
        gp, 
        village, 
        receivedBy, 
        receivedDate, 
        remarks 
      } = req.body;

      if (!activityUuid) {
        return res.status(400).json({ success: false, error: "Missing required activityUuid for matching" });
      }

      if (!fileData) {
        return res.status(400).json({ success: false, error: "Missing fileData (base64) for upload" });
      }

      const cleanUuid = String(activityUuid).replace(/[^a-zA-Z0-9_-]/g, "");
      const ext = (fileName && fileName.includes(".")) ? fileName.split(".").pop() : "jpg";
      const timestamp = Date.now();
      const localFileName = "ack_" + cleanUuid + "_" + timestamp + "." + ext;
      const localFilePath = path.join(process.cwd(), "public", "uploads", localFileName);

      // 1. Save local backup file
      try {
        const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        if (!fs.existsSync(path.join(process.cwd(), "public", "uploads"))) {
          fs.mkdirSync(path.join(process.cwd(), "public", "uploads"), { recursive: true });
        }
        fs.writeFileSync(localFilePath, buffer);
      } catch (saveErr) {
        console.warn("[UPLOAD] Failed to save local backup file:", saveErr.message);
      }

      const localUrl = "/uploads/" + localFileName;
      let driveUrl = "";

      // 2. Upload to Google Drive via Google Apps Script
      const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxe1GMW0s18iwtZsvmLjg5Hlf_AuIOVESDx7tqWI3wyUk7dyo5vxx1kDjgmWlFbQNn97w/exec";
      try {
        console.log("[UPLOAD] Uploading scanned copy to Google Drive for UUID " + activityUuid + "...");
        const base64Clean = fileData.replace(/^data:[^;]+;base64,/, "");
        const gasRes = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "ADD Photo",
            fileName: "ACK_" + (householdId || cleanUuid) + "_" + (fileName || "signed_ack.jpg"),
            mimeType: fileType || "image/jpeg",
            type: "acknowledgement",
            description: "Physical Signed Acknowledgement for " + (beneficiaryName || "Beneficiary") + " (Household ID: " + (householdId || "N/A") + ", UUID: " + activityUuid + ")",
            activity: activityName || "Acknowledgement",
            uploadedBy: receivedBy || "Office Staff",
            data: base64Clean
          })
        });

        const gasText = await gasRes.text();
        try {
          const gasJson = JSON.parse(gasText);
          if (gasJson.status === "success" && gasJson.url) {
            driveUrl = gasJson.url;
            console.log("[UPLOAD] Google Drive upload SUCCESS! Drive URL: " + driveUrl);
          }
        } catch {
          if (gasText.includes("drive.google.com")) {
            const match = gasText.match(/https:\\/\\/drive\\.google\\.com\\/[^"'\s]+/);
            if (match) driveUrl = match[0];
          }
        }
      } catch (gasErr) {
        console.warn("[UPLOAD] Google Drive upload failed or timed out:", gasErr.message);
      }

      const chosenSoftCopyUrl = driveUrl || localUrl;

      // 3. Find or Create the Acknowledgement Record matching UUID
      let record = memoryAcknowledgements.find(a => a.activity_uuid === activityUuid);
      if (!record) {
        const ackNum = "P1198-BHM-2026-" + String(ackCounter++).padStart(6, "0");
        record = {
          id: "ack_" + Math.random().toString(36).substring(2, 11),
          acknowledgement_number: ackNum,
          activity_uuid: activityUuid,
          beneficiary_id: beneficiaryId || "",
          household_id: householdId || "",
          farmer_id: householdId || "",
          activity_name: activityName || "NS",
          beneficiary_name: beneficiaryName || "Beneficiary",
          cluster: cluster || "",
          gp: gp || "",
          village: village || "",
          generation_status: "GENERATED",
          pdf_storage_path: "/acknowledgements/" + ackNum + ".pdf",
          pdf_version: 1,
          hard_copy_received: "YES",
          hard_copy_status: "YES",
          received_date: receivedDate || new Date().toISOString(),
          received_by: receivedBy || "Office Staff",
          soft_copy_url: chosenSoftCopyUrl,
          local_backup_url: localUrl,
          drive_url: driveUrl || null,
          photography_consent: "NOT_RECORDED",
          remarks: remarks || "Signed hard copy received at office and uploaded to Google Drive",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        memoryAcknowledgements.unshift(record);
      } else {
        record.hard_copy_received = "YES";
        record.hard_copy_status = "YES";
        record.received_date = receivedDate || new Date().toISOString();
        record.received_by = receivedBy || "Office Staff";
        record.soft_copy_url = chosenSoftCopyUrl;
        record.local_backup_url = localUrl;
        if (driveUrl) record.drive_url = driveUrl;
        if (remarks) record.remarks = remarks;
        record.updated_at = new Date().toISOString();
      }

      saveAcknowledgementsToFile();

      res.json({
        success: true,
        message: "Scanned hard copy uploaded and marked as received successfully!",
        acknowledgement: record,
        softCopyUrl: chosenSoftCopyUrl,
        driveUrl: driveUrl || null,
        localUrl: localUrl
      });
    } catch (uploadHandlerErr) {
      console.error("[UPLOAD] Handler error:", uploadHandlerErr);
      res.status(500).json({ success: false, error: uploadHandlerErr.message });
    }
  });

  app.post("/api/acknowledgements/consent", (req, res) => {
    const { id, consent } = req.body;
    const record = memoryAcknowledgements.find(a => a.id === id || a.acknowledgement_number === id || a.activity_uuid === id);
    if (!record) {
      return res.status(404).json({ error: "Acknowledgement record not found" });
    }
    record.photography_consent = consent || "YES";
    record.updated_at = new Date().toISOString();
    saveAcknowledgementsToFile();
    res.json({ success: true, acknowledgement: record });
  });

  app.post("/api/acknowledgements/bulk", (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid items array for bulk generation" });
    }
    const generated = [];
    for (const item of items) {
      let existing = memoryAcknowledgements.find(a => (item.activityUuid && a.activity_uuid === item.activityUuid) || (item.beneficiaryId && a.beneficiary_id === item.beneficiaryId));
      if (!existing) {
        const ackNum = "P1198-BHM-2026-" + String(ackCounter++).padStart(6, "0");
        existing = {
          id: "ack_" + Math.random().toString(36).substring(2, 11),
          acknowledgement_number: ackNum,
          activity_uuid: item.activityUuid || "",
          beneficiary_id: item.beneficiaryId || "",
          household_id: item.householdId || item.farmerId || "",
          farmer_id: item.farmerId || item.householdId || "",
          activity_name: item.activityName || "NS",
          beneficiary_name: item.beneficiaryName || "Beneficiary",
          cluster: item.cluster || "Cluster 1",
          gp: item.gp || "GP",
          village: item.village || "Village",
          generation_status: "GENERATED",
          pdf_storage_path: "/acknowledgements/" + ackNum + ".pdf",
          pdf_version: 1,
          hard_copy_received: "PENDING",
          hard_copy_status: "PENDING",
          received_date: null,
          received_by: null,
          soft_copy_url: null,
          local_backup_url: null,
          photography_consent: "NOT_RECORDED",
          remarks: "Bulk generated successfully",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        memoryAcknowledgements.unshift(existing);
      }
      generated.push(existing);
    }
    saveAcknowledgementsToFile();
    res.json({ success: true, count: generated.length, acknowledgements: generated });
  });

`;

server = server.substring(0, startIndex) + newRoutes + server.substring(endIndex);
fs.writeFileSync("/server.ts", server, "utf8");
console.log("SUCCESS: /server.ts updated successfully!");
