const fs = require("fs");

function updateModalTemplate(content, sheetId, isAckData) {
  const ackNumExpr = isAckData 
    ? "{selectedAckForPrint.acknowledgement_number}"
    : "P1198-BHM-2026-{Math.abs((ackLetterData.beneficiaryId || ackLetterData.farmerId || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}";

  const benNameExpr = isAckData 
    ? "{selectedAckForPrint.beneficiary_name}"
    : "{ackLetterData.beneficiaryName || ackLetterData.name}";

  const benIdExpr = isAckData 
    ? "{selectedAckForPrint.beneficiary_id}"
    : "{ackLetterData.beneficiaryId || ackLetterData.farmerId}";

  const locExpr = isAckData 
    ? "{selectedAckForPrint.village} / {selectedAckForPrint.gp}"
    : "{ackLetterData.village} / {ackLetterData.gp}";

  const clusterExpr = isAckData 
    ? "{selectedAckForPrint.cluster}"
    : "{ackLetterData.cluster}";

  const actNameExpr = isAckData 
    ? "{selectedAckForPrint.activity_name}"
    : "{ackLetterData.activity || 'NS'}";

  const dateExpr = isAckData 
    ? "{new Date(selectedAckForPrint.created_at).toLocaleDateString()}"
    : "{ackLetterData.benefitDate ? new Date(ackLetterData.benefitDate).toLocaleDateString() : new Date().toLocaleDateString()}";

  const dataVar = isAckData ? "selectedAckForPrint" : "ackLetterData";
  const closeSetter = isAckData ? "setSelectedAckForPrint(null)" : "setAckLetterData(null)";

  const targetSheetStart = content.indexOf('<div id="' + sheetId + '"');
  const targetSheetEnd = content.indexOf("</div>\n                    </div>\n                </div>", targetSheetStart);

  if (targetSheetStart === -1 || targetSheetEnd === -1) {
    console.log("Could not find sheet in file for", sheetId, targetSheetStart, targetSheetEnd);
    return content;
  }

  const newSheetJSX = `<div id="${sheetId}" className="mx-auto bg-white border border-gray-300 rounded-xl shadow-lg flex flex-col justify-between overflow-hidden a4-print-sheet print:border-none print:shadow-none print:m-0" style={{ width: "100%", maxWidth: "794px", minHeight: "1123px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff" }}>
                            {/* 1. Official Google Docs Letterhead Header */}
                            <div className="w-full bg-white flex-shrink-0" style={{ width: "100%", margin: 0, padding: 0 }}>
                                <img 
                                    src={LETTERHEAD_HEADER_BASE64} 
                                    alt="HDFC Bank Parivartan – WASSAN Letterhead" 
                                    className="w-full block select-none" 
                                    style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block", border: 0 }}
                                />
                            </div>

                            {/* 2. Letter Content Area */}
                            <div className="p-8 py-3 space-y-3.5 a4-content-area text-gray-900 font-sans flex-1" style={{ padding: "8px 45px 6px 45px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", boxSizing: "border-box" }}>
                                {/* Ack Number and Date Header */}
                                <div className="flex justify-between items-center text-xs font-bold border-b border-gray-300 pb-1.5" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #d1d5db", paddingBottom: "6px", fontSize: "11px" }}>
                                    <span className="font-mono text-indigo-900 font-black" style={{ fontFamily: "monospace", color: "#1e1b4b", fontWeight: 900 }}>
                                        రసీదు సంఖ్య (ACK NO): ${ackNumExpr}
                                    </span>
                                    <span style={{ fontSize: "11px", fontWeight: "bold" }}>తేదీ (Date): {new Date().toLocaleDateString("te-IN")}</span>
                                </div>

                                {/* Telugu Letter Title */}
                                <div className="text-center space-y-0.5 a4-title" style={{ textAlign: "center", margin: "4px 0" }}>
                                    <h2 className="text-lg font-black text-gray-900 tracking-wide" style={{ fontSize: "15px", fontWeight: 900, color: "#111827", margin: 0 }}>
                                        వస్తువుల స్వీకరణ, పనుల నిర్మాణం పూర్తి మరియు ఫోటోగ్రఫీ సమ్మతి పత్రం
                                    </h2>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest" style={{ fontSize: "9px", fontWeight: "bold", color: "#4b5563", letterSpacing: "1px", margin: "2px 0 0 0", textTransform: "uppercase" }}>
                                        HDFC Bank Parivartan – WASSAN Livelihood Initiative (Project Bhamini-P1198)
                                    </p>
                                </div>

                                {/* Beneficiary Information Grid */}
                                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50/80 p-2.5 rounded-xl border border-gray-200 a4-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "11px" }}>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>లబ్ధిదారుని పేరు (Name):</span> <span style={{ fontWeight: 900, color: "#111827", marginLeft: "4px" }}>${benNameExpr}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>లబ్ధిదారుని ఐడి (Beneficiary ID):</span> <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>${benIdExpr}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>గ్రామం / పంచాయతీ (Village/GP):</span> <span style={{ fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>${locExpr}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>క్లస్టర్ (Cluster):</span> <span style={{ fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>${clusterExpr}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>కార్యాచరణ (Activity Name):</span> <span style={{ fontWeight: 900, color: "#312e81", marginLeft: "4px" }}>${actNameExpr}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>పూర్తయిన తేదీ (Completion Date):</span> <span style={{ fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>${dateExpr}</span></div>
                                </div>

                                {/* Material Details Table */}
                                <div style={{ margin: "4px 0" }}>
                                    <h3 style={{ fontSize: "10.5px", fontWeight: 900, textTransform: "uppercase", color: "#1f2937", letterSpacing: "0.5px", margin: "0 0 4px 0" }}>
                                        అందజేయబడిన వస్తువులు / సహాయ వివరాలు (ISSUED MATERIALS & ASSETS)
                                    </h3>
                                    <table className="w-full text-xs border-collapse border border-gray-400 bg-white a4-table" style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff", fontSize: "11px" }}>
                                        <thead>
                                            <tr style={{ background: "#f3f4f6", color: "#111827", fontWeight: 900 }}>
                                                <th style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", width: "45px" }}>క్రమ సంఖ్య</th>
                                                <th style={{ border: "1px solid #9ca3af", padding: "4px 8px", textAlign: "left" }}>వస్తువు పేరు (Material / Asset Name)</th>
                                                <th style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", width: "70px" }}>పరిమాణం</th>
                                                <th style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", width: "70px" }}>యూనిట్</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const mats = modalMaterials.length > 0 ? modalMaterials : getIssuedMaterials(${dataVar});
                                                return mats.map((mat: any, idx: number) => {
                                                    const display = getAssetDisplayLabel(mat);
                                                    return (
                                                        <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fcfcfd" }}>
                                                            <td style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", fontWeight: "bold", color: "#374151" }}>{idx + 1}</td>
                                                            <td style={{ border: "1px solid #9ca3af", padding: "4px 8px" }}>
                                                                <span style={{ fontWeight: "bold", color: "#111827", display: "block" }}>{display.title}</span>
                                                                {display.subtitle && display.subtitle !== display.title && (
                                                                    <span style={{ fontSize: "9.5px", color: "#6b7280", display: "block", marginTop: "1px" }}>{display.subtitle}</span>
                                                                )}
                                                            </td>
                                                            <td style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", fontWeight: "bold", color: "#111827" }}>{mat.count || 1}</td>
                                                            <td style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", color: "#374151", fontWeight: 500 }}>{mat.unit || "Unit"}</td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Beneficiary Acknowledgement & Declarations (All 3 Key Points) */}
                                <div className="text-xs bg-gray-50/90 p-2.5 rounded-xl border border-gray-200 a4-decl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "10.5px", display: "flex", flexDirection: "column", gap: "5px" }}>
                                    <h4 style={{ fontSize: "10.5px", fontWeight: 900, textTransform: "uppercase", color: "#1e1b4b", letterSpacing: "0.5px", margin: "0 0 2px 0" }}>
                                        లబ్ధిదారుని స్వీకృతి & ధృవీకరణ పత్రం (BENEFICIARY ACKNOWLEDGEMENT & DECLARATIONS)
                                    </h4>
                                    
                                    {/* Point 1: Receipt of Materials */}
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                        <span style={{ fontWeight: "bold", color: "#4338ca" }}>1.</span>
                                        <p style={{ margin: 0, lineHeight: 1.35 }}>
                                            <strong>వస్తువుల స్వీకరణ (Receipt of Materials):</strong> పైన పట్టికలో పేర్కొన్న వస్తువులు / సహాయ సామాగ్రిని నా జీవనోపాధి అభివృద్ధి కొరకు వాసన్ (WASSAN) ద్వారా సరైన స్థితిలో పూర్తిగా స్వీకరించాను.
                                        </p>
                                    </div>

                                    {/* Point 2: Construction / Installation Completion */}
                                    <div className="a4-decl-highlight" style={{ display: "flex", alignItems: "flex-start", gap: "6px", background: "#eef2ff", padding: "5px 8px", borderRadius: "6px", border: "1px solid #c7d2fe" }}>
                                        <span style={{ fontWeight: 900, color: "#3730a3" }}>2.</span>
                                        <p style={{ margin: 0, lineHeight: 1.35, color: "#1e1b4b" }}>
                                            <strong>పనుల నిర్మాణం / సంస్థాపన పూర్తి (Completion of Work / Installation):</strong> HDFC బ్యాంక్ పరివర్తన్ (HDFC Bank Parivartan) వారి ఆర్థిక సహాయంతో, వాసన్ (WASSAN) సంస్థ ద్వారా నాకు మంజూరు చేయబడిన పనుల నిర్మాణం / వస్తువుల సంస్థాపన (Construction of work / Installation) ను నేను క్షేత్రస్థాయిలో విజయవంతంగా మరియు సంతృప్తికరంగా పూర్తి చేశానని దీనిద్వారా ధృవీకరిస్తున్నాను / అంగీకరిస్తున్నాను.
                                        </p>
                                    </div>

                                    {/* Point 3: Photography Consent */}
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", borderTop: "1px solid #e5e7eb", paddingTop: "4px" }}>
                                        <span style={{ fontWeight: "bold", color: "#4b5563" }}>3.</span>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
                                            <p style={{ margin: 0, lineHeight: 1.35, fontSize: "10px", color: "#374151" }}>
                                                <strong>ఫోటోగ్రఫీ సమ్మతి (Photography Consent):</strong> ప్రాజెక్ట్ డాక్యుమెంటేషన్, పర్యవేక్షణ కొరకు నా ఫోటో / పూర్తయిన పనుల ఫోటోల వినియోగానికి స్వచ్ఛందంగా సమ్మతిస్తున్నాను (ఫోటోగ్రఫీ సమ్మతి నిరాకరించడం వలన ప్రాజెక్ట్ ప్రయోజనాలపై ఎటువంటి ప్రభావం ఉండదు).
                                            </p>
                                            <div style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: "10.5px", fontWeight: "bold", paddingTop: "2px" }}>
                                                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "13px", height: "13px", border: "1px solid #6b7280", display: "inline-block", borderRadius: "3px", background: "#ffffff" }}></span> సమ్మతిస్తున్నాను (Yes)</span>
                                                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "13px", height: "13px", border: "1px solid #6b7280", display: "inline-block", borderRadius: "3px", background: "#ffffff" }}></span> సమ్మతించడం లేదు (No)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Signatures */}
                                <div className="a4-sig" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: "12px", paddingBottom: "2px", fontSize: "11px", fontWeight: "bold", color: "#111827" }}>
                                    <div style={{ textAlign: "center" }}>
                                        <div className="a4-sig-line" style={{ height: "28px", borderBottom: "1px dashed #6b7280", width: "170px", marginBottom: "4px" }}></div>
                                        <p style={{ margin: 0 }}>లబ్ధిదారుని సంతకం / వేలిముద్ర</p>
                                        <p style={{ margin: "2px 0 0 0", fontSize: "9px", color: "#6b7280", fontWeight: "normal" }}>Beneficiary Signature / Thumb Impression</p>
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <div className="a4-sig-line" style={{ height: "28px", borderBottom: "1px dashed #6b7280", width: "170px", marginBottom: "4px" }}></div>
                                        <p style={{ margin: 0 }}>అధికారిక సంతకం</p>
                                        <p style={{ margin: "2px 0 0 0", fontSize: "9px", color: "#6b7280", fontWeight: "normal" }}>WASSAN / HDFC Parivartan Project Team</p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Official Google Docs Letterhead Footer */}
                            <div className="w-full bg-white mt-auto flex-shrink-0" style={{ width: "100%", marginTop: "auto", margin: 0, padding: 0 }}>
                                <img 
                                    src={LETTERHEAD_FOOTER_BASE64} 
                                    alt="HDFC Bank Parivartan – WASSAN Letterhead Footer" 
                                    className="w-full block select-none" 
                                    style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block", border: 0 }}
                                />
                            </div>
                        </div>`;

  return content.substring(0, targetSheetStart) + newSheetJSX + content.substring(targetSheetEnd);
}

// 1. Update ActivityStatusDashboard.tsx
let act = fs.readFileSync("components/ActivityStatusDashboard.tsx", "utf8");
act = updateModalTemplate(act, "activity-status-ack-sheet", false);
fs.writeFileSync("components/ActivityStatusDashboard.tsx", act, "utf8");
console.log("SUCCESS: Patched ActivityStatusDashboard with inline styles");

// 2. Update BeneficiaryAcknowledgementPortal.tsx
let portal = fs.readFileSync("components/BeneficiaryAcknowledgementPortal.tsx", "utf8");
portal = updateModalTemplate(portal, "portal-ack-sheet", true);
fs.writeFileSync("components/BeneficiaryAcknowledgementPortal.tsx", portal, "utf8");
console.log("SUCCESS: Patched BeneficiaryAcknowledgementPortal with inline styles");
