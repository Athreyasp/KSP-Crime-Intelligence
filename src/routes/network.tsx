import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from "d3-force";
import {
  Search, Radar, Focus, Users, Car, Phone, MapPin as PinIcon, Fingerprint, FileText, Sparkles, ChevronRight,
  ShieldAlert, Eye, RotateCcw, Clock, Database, X, LayoutGrid, Network as NetworkIcon, ArrowUpRight, Shield, Globe, Navigation,
  Radio, Activity, CheckCircle2, ArrowRight, Maximize2, Download, PhoneCall, Smartphone, Signal
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type EntityType, type RichNode, type RelationType, type TravelCheckpoint, type CallLogEntry,
  createTravelHistory, getUniqueVehicleDetails, getFormatted10DigitPhone, createCallLogs, exportToCsv
} from "@/data/network-rich";
import { useDb } from "@/hooks/use-db";
import { useLanguage } from "@/hooks/use-language";
import { PageHeader } from "@/components/page-header";
import { DISTRICTS } from "@/data/mock";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Network Atlas · Google Material Police Intelligence" },
      { name: "description", content: "Ultra-clean Google Material 3 link intelligence workspace derived from Zoho database FIR records." },
    ],
  }),
  component: NetworkPage,
});

/* ------------------------------------------------------------------ */
/* Types & Metadata Palette                                           */
/* ------------------------------------------------------------------ */
type SimNode = RichNode & SimulationNodeDatum & { x: number; y: number };
type SimLink = { source: SimNode; target: SimNode; relation: RelationType; weight: number };

const W = 1000;
const H = 620;

const TYPE_META: Record<EntityType, { color: string; bg: string; border: string; label: string; Icon: typeof Users }> = {
  accused: { color: "#c5221f", bg: "#fce8e6", border: "#f8b4b0", label: "Suspect", Icon: Fingerprint },
  victim: { color: "#1a73e8", bg: "#e8f0fe", border: "#aecbfa", label: "Victim", Icon: Users },
  case: { color: "#b06000", bg: "#fef7e0", border: "#feefc3", label: "FIR Case", Icon: FileText },
  location: { color: "#137333", bg: "#e6f4ea", border: "#ceead6", label: "Location", Icon: PinIcon },
  vehicle: { color: "#1a73e8", bg: "#e8f0fe", border: "#aecbfa", label: "Vehicle", Icon: Car },
  phone: { color: "#0284c7", bg: "#e0f2fe", border: "#bae6fd", label: "Phone", Icon: Phone },
};

/* ------------------------------------------------------------------ */
/* Force Layout Hook (Spacious Anti-Congestion Physics)               */
/* ------------------------------------------------------------------ */
function useForceLayout(networkRich: any) {
  return useMemo(() => {
    if (!networkRich || !networkRich.nodes || networkRich.nodes.length === 0) {
      return { nodes: [], links: [] };
    }
    const nodes: SimNode[] = networkRich.nodes.map((n: any) => ({
      ...n,
      x: W / 2 + (Math.random() - 0.5) * 450,
      y: H / 2 + (Math.random() - 0.5) * 320
    }));
    const idx = new Map(nodes.map(n => [n.id, n]));
    const links = networkRich.edges
      .map((e: any) => ({
        source: idx.get(e.source)!,
        target: idx.get(e.target)!,
        relation: e.relation,
        weight: e.weight || 1,
      }))
      .filter((l: any) => l.source && l.target) as SimLink[];

    const sim = forceSimulation(nodes)
      .force("link", forceLink<SimNode, SimLink>(links).id((d: SimNode) => d.id).distance(155).strength(0.45))
      .force("charge", forceManyBody<SimNode>().strength(-460))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<SimNode>().radius(42).strength(0.85))
      .stop();

    for (let i = 0; i < 120; i++) sim.tick();
    return { nodes, links };
  }, [networkRich]);
}

/* ------------------------------------------------------------------ */
/* PDF Report Generation Helpers (Karnataka State Police SCRB Format)  */
/* ------------------------------------------------------------------ */
import kspLogo from "@/assets/karnataka-police-logo.png";

function exportVehiclePdfReport(targetPlate: string, vehInfo: any, travelLogs: TravelCheckpoint[]) {
  const printWindow = window.open("", "_blank", "width=980,height=1000");
  if (!printWindow) {
    toast.error("Pop-up window blocked. Please allow pop-ups to view/export the PDF report.");
    return;
  }

  const rowsHtml = travelLogs.map((cp, idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 7px 8px; text-align: center; font-weight: bold; color: #1a73e8;">#${idx + 1}</td>
      <td style="padding: 7px 8px;">
        <strong style="color: #0f172a; font-size: 11px;">${cp.locationName}</strong><br/>
        <span style="font-size: 9px; color: #64748b;">ID: ${cp.checkpointId} · ${cp.cameraType}</span>
      </td>
      <td style="padding: 7px 8px; font-weight: 600;">${cp.district}</td>
      <td style="padding: 7px 8px; color: #1a73e8; font-weight: bold;">${cp.timestamp}</td>
      <td style="padding: 7px 8px; font-weight: bold;">${cp.speedKmph} km/h</td>
      <td style="padding: 7px 8px;">${(cp.occupantsDetected || []).join(", ") || "Driver Only"}</td>
      <td style="padding: 7px 8px; text-align: center;">
        <span style="background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">${cp.flagStatus}</span>
      </td>
    </tr>
  `).join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>KSP ANPR Forensic Vehicle Report - ${targetPlate}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap');
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: 'EB Garamond', serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            font-size: 11px;
            line-height: 1.5;
            background: #ffffff;
            position: relative;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 420px;
            height: 420px;
            opacity: 0.05;
            pointer-events: none;
            z-index: 0;
            filter: grayscale(100%);
          }
          .content { position: relative; z-index: 1; }
          .top-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1.5px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .gov-ribbon {
            text-align: center;
            margin-bottom: 10px;
          }
          .gov-badge {
            display: inline-block;
            border: 1px solid #000;
            padding: 3px 14px;
            font-family: 'EB Garamond', serif;
            font-weight: bold;
            letter-spacing: 2px;
            font-size: 9.5px;
            text-transform: uppercase;
            background: #ffffff;
          }
          .header-main {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .logo-img {
            width: 70px;
            height: 70px;
            object-fit: contain;
          }
          .title-box {
            text-align: center;
            flex: 1;
            padding: 0 12px;
          }
          .title-box h1 {
            margin: 0;
            font-size: 17px;
            font-weight: bold;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .title-box h2 {
            margin: 3px 0 0 0;
            font-size: 11px;
            color: #1a73e8;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .plate-badge {
            background: #1a73e8;
            color: #ffffff;
            padding: 5px 14px;
            border-radius: 6px;
            font-family: 'Courier Prime', monospace;
            font-weight: 700;
            font-size: 16px;
            letter-spacing: 1px;
            display: inline-block;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            border: 1.5px solid #000;
            padding: 12px;
            margin-bottom: 16px;
            background: #fafafa;
          }
          .meta-item { display: flex; flex-direction: column; gap: 1px; }
          .meta-label { font-size: 8.5px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta-val { font-family: 'Courier Prime', monospace; font-weight: bold; font-size: 11px; color: #0f172a; }
          .section-heading {
            font-family: 'EB Garamond', serif;
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1.5px solid #000;
            padding-bottom: 4px;
            margin-top: 16px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000;
            font-family: 'Courier Prime', monospace;
            font-size: 10px;
          }
          .data-table th {
            background: #f1f5f9;
            border: 1px solid #000;
            padding: 7px 8px;
            text-align: left;
            font-weight: bold;
            font-size: 8.5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .data-table td {
            border: 1px solid #cbd5e1;
          }
          .sig-container {
            margin-top: 36px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .seal-box {
            border: 2px dashed #1a73e8;
            padding: 10px 16px;
            border-radius: 6px;
            background: #eff6ff;
            color: #1a73e8;
            font-family: 'Courier Prime', monospace;
            font-size: 9.5px;
            font-weight: bold;
            text-align: center;
          }
          .sig-box { text-align: right; }
          .sig-line { width: 210px; border-bottom: 1.5px solid #000; display: inline-block; margin-bottom: 4px; }
          .footer {
            margin-top: 24px;
            border-top: 1px solid #000;
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
            font-family: 'Courier Prime', monospace;
            font-size: 8.5px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <!-- Background Official Seal Watermark -->
        <img src="${kspLogo}" class="watermark" alt="" />

        <div class="content">
          <!-- Top Meta Barcode & QR Bar -->
          <div class="top-meta">
            <div>
              <svg style="width: 120px; height: 16px;" viewBox="0 0 160 20">
                <rect x="0" y="0" width="3" height="20" fill="black" />
                <rect x="5" y="0" width="1" height="20" fill="black" />
                <rect x="8" y="0" width="4" height="20" fill="black" />
                <rect x="14" y="0" width="1" height="20" fill="black" />
                <rect x="17" y="0" width="3" height="20" fill="black" />
                <rect x="22" y="0" width="5" height="20" fill="black" />
                <rect x="29" y="0" width="1" height="20" fill="black" />
                <rect x="32" y="0" width="3" height="20" fill="black" />
                <rect x="40" y="0" width="4" height="20" fill="black" />
                <rect x="49" y="0" width="5" height="20" fill="black" />
                <rect x="56" y="0" width="3" height="20" fill="black" />
                <rect x="64" y="0" width="4" height="20" fill="black" />
                <rect x="75" y="0" width="1" height="20" fill="black" />
                <rect x="84" y="0" width="5" height="20" fill="black" />
                <rect x="99" y="0" width="1" height="20" fill="black" />
                <rect x="108" y="0" width="3" height="20" fill="black" />
                <rect x="123" y="0" width="4" height="20" fill="black" />
                <rect x="137" y="0" width="5" height="20" fill="black" />
              </svg>
              <div style="font-family: 'Courier Prime', monospace; font-size: 7px; color: #64748b;">CCTNS-ANPR-${targetPlate.replace(/[^A-Z0-9]/g, "")}</div>
            </div>

            <div style="text-align: center; font-size: 8px; font-family: 'EB Garamond', serif; font-weight: bold;">
              INTEGRATED CRIME RECORDS HUB (CCTNS CLOUD)<br/>
              <span style="color: #1a73e8;">STATUS: OFFICIAL TELEMETRY EVIDENCE RECORD</span>
            </div>

            <div style="border: 1px solid #000; padding: 4px 8px; font-family: 'Courier Prime', monospace; font-size: 7px; text-align: center;">
              <strong>KSP VERIFIED</strong><br/>
              <span>SHA: ANPR-${Date.now().toString().slice(-6)}</span>
            </div>
          </div>

          <!-- Government Ribbon Header -->
          <div class="gov-ribbon">
            <div class="gov-badge">Government of Karnataka · State Crime Records Bureau</div>
          </div>

          <!-- Main Header with Logo -->
          <div class="header-main">
            <img src="${kspLogo}" class="logo-img" alt="KSP Logo" />
            <div class="title-box">
              <h1>KARNATAKA STATE POLICE DEPARTMENT</h1>
              <h2>ANPR AUTOMATIC LICENSE PLATE RECOGNITION FORENSIC MOVEMENT REPORT</h2>
            </div>
            <div>
              <span class="plate-badge">${targetPlate}</span>
            </div>
          </div>

          <!-- Metadata Summary Grid -->
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Registration Plate</span>
              <span class="meta-val" style="color: #1a73e8;">${targetPlate}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Make & Model</span>
              <span class="meta-val">${vehInfo.makeModel || "Toyota Fortuner Legender 4x4"}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Registered Owner</span>
              <span class="meta-val">${vehInfo.ownerName || "Athreya (Registered)"}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Vehicle Category</span>
              <span class="meta-val">${vehInfo.category || "SUV"}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Primary Jurisdiction</span>
              <span class="meta-val">${vehInfo.district || "Bengaluru Urban"}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">ANPR Checkpoints Traversed</span>
              <span class="meta-val" style="color: #1a73e8;">${travelLogs.length} Camera Checkpoints</span>
            </div>
          </div>

          <!-- Section Heading -->
          <div class="section-heading">
            <span>Chronological ANPR Camera Surveillance Trajectory</span>
            <span style="font-size: 9px; font-weight: normal; color: #64748b;">CONFIDENTIAL LAW ENFORCEMENT EVIDENCE</span>
          </div>

          <!-- ANPR Data Table -->
          <table class="data-table">
            <thead>
              <tr>
                <th style="text-align: center; width: 35px;">Scan</th>
                <th>Checkpoint Location / Camera Site</th>
                <th>District</th>
                <th>Timestamp</th>
                <th>Speed</th>
                <th>Occupants Detected</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- Official Signatures & Digital Seal -->
          <div class="sig-container">
            <div class="seal-box">
              🔒 OFFICIAL DIGITAL TELEMETRY SEAL<br/>
              STATE CRIME RECORDS BUREAU (SCRB) · KARNATAKA
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <p style="margin: 0; font-size: 11px; font-weight: bold; font-family: 'EB Garamond', serif;">Investigating Officer Signature</p>
              <p style="margin: 2px 0 0 0; font-size: 9px; font-family: 'Courier Prime', monospace; color: #475569;">State Crime Records Bureau (SCRB)</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <span>Official Law Enforcement Evidence Document · Strictly Confidential</span>
            <span>Generated on: ${new Date().toLocaleString("en-IN")}</span>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

function exportPhonePdfReport(targetPhone: string, subscriber: string, operator: string, imei: string, districtName: string, callLogs: CallLogEntry[]) {
  const printWindow = window.open("", "_blank", "width=980,height=1000");
  if (!printWindow) {
    toast.error("Pop-up window blocked. Please allow pop-ups to view/export the PDF report.");
    return;
  }

  const rowsHtml = callLogs.map((log, idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 7px 8px; text-align: center; font-weight: bold; color: #0284c7;">#${idx + 1}</td>
      <td style="padding: 7px 8px;">
        <span style="background: ${log.type === "Incoming" ? "#f0fdf4" : log.type === "Outgoing" ? "#eff6ff" : "#fef2f2"}; color: ${log.type === "Incoming" ? "#166534" : log.type === "Outgoing" ? "#1d4ed8" : "#991b1b"}; font-weight: bold; padding: 2px 7px; border-radius: 4px; font-size: 9px; border: 1px solid ${log.type === "Incoming" ? "#bbf7d0" : log.type === "Outgoing" ? "#bfdbfe" : "#fca5a5"};">${log.type}</span>
      </td>
      <td style="padding: 7px 8px; font-family: 'Courier Prime', monospace; font-weight: bold; color: #0f172a; font-size: 11px;">${log.otherPartyNumber}</td>
      <td style="padding: 7px 8px; font-weight: bold; color: #334155;">${log.otherPartyName}</td>
      <td style="padding: 7px 8px; font-family: 'Courier Prime', monospace; font-weight: bold; color: #0284c7;">${log.durationSeconds > 0 ? `${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s` : "0s (No Ans)"}</td>
      <td style="padding: 7px 8px; color: #334155;">${log.towerLocation} <span style="color: #64748b; font-size: 9px;">(${log.towerId})</span></td>
      <td style="padding: 7px 8px; font-weight: 600;">${log.district}</td>
      <td style="padding: 7px 8px; color: #0284c7; font-weight: bold;">${log.timestamp}</td>
    </tr>
  `).join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>KSP CDR Telecom Forensic Report - ${targetPhone}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap');
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: 'EB Garamond', serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            font-size: 11px;
            line-height: 1.5;
            background: #ffffff;
            position: relative;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 420px;
            height: 420px;
            opacity: 0.05;
            pointer-events: none;
            z-index: 0;
            filter: grayscale(100%);
          }
          .content { position: relative; z-index: 1; }
          .top-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1.5px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .gov-ribbon {
            text-align: center;
            margin-bottom: 10px;
          }
          .gov-badge {
            display: inline-block;
            border: 1px solid #000;
            padding: 3px 14px;
            font-family: 'EB Garamond', serif;
            font-weight: bold;
            letter-spacing: 2px;
            font-size: 9.5px;
            text-transform: uppercase;
            background: #ffffff;
          }
          .header-main {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .logo-img {
            width: 70px;
            height: 70px;
            object-fit: contain;
          }
          .title-box {
            text-align: center;
            flex: 1;
            padding: 0 12px;
          }
          .title-box h1 {
            margin: 0;
            font-size: 17px;
            font-weight: bold;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .title-box h2 {
            margin: 3px 0 0 0;
            font-size: 11px;
            color: #0284c7;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .phone-badge {
            background: #0284c7;
            color: #ffffff;
            padding: 5px 14px;
            border-radius: 6px;
            font-family: 'Courier Prime', monospace;
            font-weight: 700;
            font-size: 16px;
            letter-spacing: 1px;
            display: inline-block;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            border: 1.5px solid #000;
            padding: 12px;
            margin-bottom: 16px;
            background: #fafafa;
          }
          .meta-item { display: flex; flex-direction: column; gap: 1px; }
          .meta-label { font-size: 8.5px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta-val { font-family: 'Courier Prime', monospace; font-weight: bold; font-size: 11px; color: #0f172a; }
          .section-heading {
            font-family: 'EB Garamond', serif;
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1.5px solid #000;
            padding-bottom: 4px;
            margin-top: 16px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000;
            font-family: 'Courier Prime', monospace;
            font-size: 10px;
          }
          .data-table th {
            background: #f1f5f9;
            border: 1px solid #000;
            padding: 7px 8px;
            text-align: left;
            font-weight: bold;
            font-size: 8.5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .data-table td {
            border: 1px solid #cbd5e1;
          }
          .sig-container {
            margin-top: 36px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .seal-box {
            border: 2px dashed #0284c7;
            padding: 10px 16px;
            border-radius: 6px;
            background: #f0f9ff;
            color: #0284c7;
            font-family: 'Courier Prime', monospace;
            font-size: 9.5px;
            font-weight: bold;
            text-align: center;
          }
          .sig-box { text-align: right; }
          .sig-line { width: 210px; border-bottom: 1.5px solid #000; display: inline-block; margin-bottom: 4px; }
          .footer {
            margin-top: 24px;
            border-top: 1px solid #000;
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
            font-family: 'Courier Prime', monospace;
            font-size: 8.5px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <!-- Background Official Seal Watermark -->
        <img src="${kspLogo}" class="watermark" alt="" />

        <div class="content">
          <!-- Top Meta Barcode & QR Bar -->
          <div class="top-meta">
            <div>
              <svg style="width: 120px; height: 16px;" viewBox="0 0 160 20">
                <rect x="0" y="0" width="3" height="20" fill="black" />
                <rect x="5" y="0" width="1" height="20" fill="black" />
                <rect x="8" y="0" width="4" height="20" fill="black" />
                <rect x="14" y="0" width="1" height="20" fill="black" />
                <rect x="17" y="0" width="3" height="20" fill="black" />
                <rect x="22" y="0" width="5" height="20" fill="black" />
                <rect x="29" y="0" width="1" height="20" fill="black" />
                <rect x="32" y="0" width="3" height="20" fill="black" />
                <rect x="40" y="0" width="4" height="20" fill="black" />
                <rect x="49" y="0" width="5" height="20" fill="black" />
                <rect x="56" y="0" width="3" height="20" fill="black" />
                <rect x="64" y="0" width="4" height="20" fill="black" />
                <rect x="75" y="0" width="1" height="20" fill="black" />
                <rect x="84" y="0" width="5" height="20" fill="black" />
                <rect x="99" y="0" width="1" height="20" fill="black" />
                <rect x="108" y="0" width="3" height="20" fill="black" />
                <rect x="123" y="0" width="4" height="20" fill="black" />
                <rect x="137" y="0" width="5" height="20" fill="black" />
              </svg>
              <div style="font-family: 'Courier Prime', monospace; font-size: 7px; color: #64748b;">CCTNS-CDR-${targetPhone.replace(/[^0-9]/g, "")}</div>
            </div>

            <div style="text-align: center; font-size: 8px; font-family: 'EB Garamond', serif; font-weight: bold;">
              INTEGRATED CRIME RECORDS HUB (CCTNS CLOUD)<br/>
              <span style="color: #0284c7;">STATUS: TELECOM TOWER INTERCEPT EVIDENCE RECORD</span>
            </div>

            <div style="border: 1px solid #000; padding: 4px 8px; font-family: 'Courier Prime', monospace; font-size: 7px; text-align: center;">
              <strong>KSP VERIFIED</strong><br/>
              <span>SHA: CDR-${Date.now().toString().slice(-6)}</span>
            </div>
          </div>

          <!-- Government Ribbon Header -->
          <div class="gov-ribbon">
            <div class="gov-badge">Government of Karnataka · State Crime Records Bureau</div>
          </div>

          <!-- Main Header with Logo -->
          <div class="header-main">
            <img src="${kspLogo}" class="logo-img" alt="KSP Logo" />
            <div class="title-box">
              <h1>KARNATAKA STATE POLICE DEPARTMENT</h1>
              <h2>CALL DETAIL RECORD (CDR) TELECOM TOWER INTERCEPT FORENSIC REPORT</h2>
            </div>
            <div>
              <span class="phone-badge">${targetPhone}</span>
            </div>
          </div>

          <!-- Metadata Summary Grid -->
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Target Subscriber Line</span>
              <span class="meta-val" style="color: #0284c7;">${targetPhone}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Subscriber Name</span>
              <span class="meta-val">${subscriber}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Telecom Operator</span>
              <span class="meta-val">${operator}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Hardware IMEI Number</span>
              <span class="meta-val">${imei}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Tower Jurisdiction</span>
              <span class="meta-val">${districtName}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Total Call Events</span>
              <span class="meta-val" style="color: #0284c7;">${callLogs.length} Records</span>
            </div>
          </div>

          <!-- Section Heading -->
          <div class="section-heading">
            <span>Chronological Call Detail Records (CDR) Feed</span>
            <span style="font-size: 9px; font-weight: normal; color: #64748b;">TELECOM INTERCEPT EVIDENCE</span>
          </div>

          <!-- CDR Data Table -->
          <table class="data-table">
            <thead>
              <tr>
                <th style="text-align: center; width: 30px;">#</th>
                <th>Call Type</th>
                <th>Target Contact Number</th>
                <th>Contact Name / Role</th>
                <th>Duration</th>
                <th>Cell Tower Location</th>
                <th>District</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- Official Signatures & Digital Seal -->
          <div class="sig-container">
            <div class="seal-box">
              📡 OFFICIAL CYBER TELECOM INTERCEPT SEAL<br/>
              STATE CRIME RECORDS BUREAU (SCRB) · KARNATAKA
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <p style="margin: 0; font-size: 11px; font-weight: bold; font-family: 'EB Garamond', serif;">Cyber & Telecom Nodal Officer Signature</p>
              <p style="margin: 2px 0 0 0; font-size: 9px; font-family: 'Courier Prime', monospace; color: #475569;">State Crime Records Bureau (SCRB)</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <span>Official Law Enforcement Evidence Document · Strictly Confidential</span>
            <span>Generated on: ${new Date().toLocaleString("en-IN")}</span>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

export function NetworkPage() {
  const navigate = useNavigate();
  const { networkRich, cases: CASES, offenders: OFFENDERS } = useDb();
  const { nodes, links } = useForceLayout(networkRich);
  const { t, language } = useLanguage();

  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SimLink | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<SimLink | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"graph" | "directory">("graph");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // State for Vehicle Travel History & Phone CDR Call Logs Modals
  const [trackingVehicleNode, setTrackingVehicleNode] = useState<SimNode | null>(null);
  const [trackingPhoneNode, setTrackingPhoneNode] = useState<SimNode | null>(null);



  // Filter nodes strictly by State Overview or Selected District Hub
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      if (selectedDistrict === "all") return true;
      const nodeDist = (n.meta.district || "").toLowerCase();
      return nodeDist === selectedDistrict.toLowerCase();
    });
  }, [nodes, selectedDistrict]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const filteredLinks = useMemo(() => {
    return links.filter(l => filteredNodeIds.has(l.source.id) && filteredNodeIds.has(l.target.id));
  }, [links, filteredNodeIds]);

  const deg = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of filteredLinks) {
      m.set(l.source.id, (m.get(l.source.id) ?? 0) + 1);
      m.set(l.target.id, (m.get(l.target.id) ?? 0) + 1);
    }
    return m;
  }, [filteredLinks]);

  // Nodes and links to render on the SVG canvas: when selected, only show target sub-network
  const svgLinks = useMemo(() => {
    if (!selected) return filteredLinks;
    return filteredLinks.filter(l => l.source.id === selected || l.target.id === selected);
  }, [filteredLinks, selected]);

  const svgNodes = useMemo(() => {
    if (!selected) return filteredNodes;
    const neighbors = new Set<string>();
    neighbors.add(selected);
    for (const l of filteredLinks) {
      if (l.source.id === selected) neighbors.add(l.target.id);
      if (l.target.id === selected) neighbors.add(l.source.id);
    }
    return filteredNodes.filter(n => neighbors.has(n.id));
  }, [filteredNodes, filteredLinks, selected]);

  // Focus Highlight
  const activeFocusId = selected || hover;
  const connectedNeighborIds = useMemo(() => {
    const set = new Set<string>();
    if (!activeFocusId) return set;
    set.add(activeFocusId);
    for (const l of filteredLinks) {
      if (l.source.id === activeFocusId) set.add(l.target.id);
      if (l.target.id === activeFocusId) set.add(l.source.id);
    }
    return set;
  }, [activeFocusId, filteredLinks]);

  const selectedNode = selected ? nodes.find(n => n.id === selected) : null;

  const getSuspectRelations = () => {
    if (!selectedNode) return [];
    const directLinks = links.filter(l => l.source.id === selectedNode.id || l.target.id === selectedNode.id);
    const relations: { name: string; id: string; type: string; relation: string; photo?: string }[] = [];

    // Find all cases this suspect/entity is in
    const myCaseIds = new Set<string>();
    directLinks.forEach(l => {
      const peer = l.source.id === selectedNode.id ? l.target : l.source;
      if (peer.type === "case") {
        myCaseIds.add(peer.id);
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Suspect In" });
      } else if (peer.type === "vehicle") {
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Shared Vehicle", photo: peer.meta?.photo });
      } else if (peer.type === "victim") {
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Target Victim", photo: peer.meta?.photo });
      } else if (peer.type === "phone") {
        relations.push({ name: peer.label, id: peer.id, type: peer.type, relation: "Burner Phone" });
      }
    });

    // Find other suspects who are co-accused in the same cases
    const seenCoAccused = new Set<string>();
    links.forEach(l => {
      const isCaseSource = l.source.type === "case";
      const isCaseTarget = l.target.type === "case";
      if (!isCaseSource && !isCaseTarget) return;

      const caseId = isCaseSource ? l.source.id : l.target.id;
      const suspect = isCaseSource ? l.target : l.source;

      if (suspect.type === "accused" && suspect.id !== selectedNode.id && myCaseIds.has(caseId)) {
        if (!seenCoAccused.has(suspect.id)) {
          seenCoAccused.add(suspect.id);
          relations.push({ name: suspect.label, id: suspect.id, type: suspect.type, relation: "Co-Accused", photo: suspect.meta.photo });
        }
      }
    });

    return relations;
  };

  // Pan / Drag controls
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { ox: pan.x, oy: pan.y, px: e.clientX, py: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPan({ x: dragRef.current.ox + (e.clientX - dragRef.current.px) / zoom, y: dragRef.current.oy + (e.clientY - dragRef.current.py) / zoom });
  };
  const onPointerUp = () => (dragRef.current = null);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* GOOGLE MATERIAL CLEAN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#dadce0] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a73e8] bg-[#e8f0fe] px-2.5 py-0.5 rounded-md border border-[#aecbfa]">
              Link Intelligence
            </span>
            <span className="text-xs text-[#5f6368] font-mono">| {selectedDistrict === "all" ? "Statewide Overview" : selectedDistrict} ({filteredNodes.length} Entities)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#202124] tracking-tight">
            {t("Criminal Association Network")}
          </h1>
          <p className="text-xs md:text-sm text-[#5f6368] mt-1">
            {t("Statewide and District-Wise Relational Intelligence Atlas")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
          <div className="flex items-center gap-1 bg-[#f8f9fa] border border-[#dadce0] p-1 rounded-lg">
            <button
              onClick={() => setViewMode("graph")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                viewMode === "graph" ? "bg-[#1a73e8] text-white font-semibold shadow-2xs" : "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
              )}
            >
              <NetworkIcon className="h-3.5 w-3.5" /> {t("Interactive Graph")}
            </button>
            <button
              onClick={() => setViewMode("directory")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                viewMode === "directory" ? "bg-[#1a73e8] text-white font-semibold shadow-2xs" : "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> {t("Link Directory")}
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => { setSelected(null); setSelectedEdge(null); setPan({ x: 0, y: 0 }); setZoom(1); setSelectedDistrict("all"); }}
            className="h-9 border-[#dadce0] text-xs font-medium rounded-lg bg-white text-[#3c4043] hover:bg-[#f1f3f4]"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-[#1a73e8]" /> {t("Reset View")}
          </Button>
        </div>
      </div>

      {/* CLEAN GOOGLE MATERIAL DISTRICT JURISDICTION FILTER BAR */}
      <Card className="bg-white border-[#dadce0] rounded-xl p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider">District Jurisdiction:</span>
            <div className="flex flex-wrap items-center gap-1 bg-[#f8f9fa] border border-[#dadce0] p-1 rounded-lg">
              <button
                onClick={() => { setSelectedDistrict("all"); setSelected(null); setSelectedEdge(null); }}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  selectedDistrict === "all"
                    ? "bg-[#1a73e8] text-white font-semibold shadow-2xs"
                    : "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
                )}
              >
                All Karnataka State
              </button>
              {["Bengaluru Urban", "Mysuru", "Dharwad", "Belagavi"].map(dName => (
                <button
                  key={dName}
                  onClick={() => { setSelectedDistrict(dName); setSelected(null); setSelectedEdge(null); }}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all hidden sm:inline-block",
                    selectedDistrict.toLowerCase() === dName.toLowerCase()
                      ? "bg-[#1a73e8] text-white font-semibold shadow-2xs"
                      : "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
                  )}
                >
                  {dName}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#5f6368]">Select District:</span>
            <select
              value={selectedDistrict}
              onChange={e => { setSelectedDistrict(e.target.value); setSelected(null); setSelectedEdge(null); }}
              className="h-8 px-3 text-xs font-medium bg-[#f8f9fa] border border-[#dadce0] rounded-lg text-[#202124] focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
            >
              <option value="all">All Karnataka Districts ({DISTRICTS.length})</option>
              {DISTRICTS.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* MAIN CONTENT AREA */}
      {viewMode === "graph" ? (
        /* MODE A: INTERACTIVE GRAPH CANVAS WITH ACCUSED, VICTIM & VEHICLE MUGSHOTS */
        <Card className="bg-white border-[#dadce0] rounded-2xl shadow-sm overflow-hidden relative flex flex-col h-[640px]">

          {/* Zoom controls & Mode Indicator */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-md border border-[#dadce0] rounded-2xl p-1 shadow-sm">
            <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} className="h-7 w-7 p-0 text-[#5f6368]">
              +
            </Button>
            <span className="font-mono text-[10px] text-[#5f6368] px-1 font-bold">{zoom.toFixed(1)}x</span>
            <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.max(0.6, z - 0.2))} className="h-7 w-7 p-0 text-[#5f6368]">
              -
            </Button>
          </div>

          <div className="flex-1 relative bg-[#ffffff] overflow-hidden">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setSelectedEdge(null); } }}
            >
              {/* SVG Mugshot & Vehicle Photo Pattern Definitions */}
              <defs>
                {svgNodes.filter(n => n.meta?.photo).map(n => {
                  const isAccused = n.type === "accused";
                  const isVehicle = n.type === "vehicle";
                  const isVictim = n.type === "victim";
                  const diameter = isAccused ? 38 : isVehicle ? 34 : isVictim ? 32 : 24;

                  return (
                    <pattern
                      key={n.id}
                      id={`pattern-${n.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                      patternUnits="objectBoundingBox"
                      width="1"
                      height="1"
                    >
                      <image
                        href={n.meta.photo}
                        x="0"
                        y="0"
                        width={diameter}
                        height={diameter}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </pattern>
                  );
                })}
              </defs>

              <g transform={`translate(${pan.x * zoom} ${pan.y * zoom}) scale(${zoom})`}>

                {/* LINKS / CONNECTIONS */}
                {svgLinks.map((l, i) => {
                  const isFocused = activeFocusId && (l.source.id === activeFocusId || l.target.id === activeFocusId);
                  const isSelectedLink = selectedEdge && selectedEdge.source.id === l.source.id && selectedEdge.target.id === l.target.id;
                  const isHoveredLink = hoverEdge && hoverEdge.source.id === l.source.id && hoverEdge.target.id === l.target.id;
                  const isDimmed = activeFocusId && !isFocused;
                  const isCoAccused = l.relation === "co-accused";

                  return (
                    <g key={i} className="group">
                      {/* Wide Invisible Hit Target for Link Clicking */}
                      <line
                        x1={l.source.x}
                        y1={l.source.y}
                        x2={l.target.x}
                        y2={l.target.y}
                        stroke="transparent"
                        strokeWidth={14}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoverEdge(l)}
                        onMouseLeave={() => setHoverEdge(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdge(l);
                          setSelected(null);
                        }}
                      />

                      {/* Visible Link Line */}
                      <line
                        x1={l.source.x}
                        y1={l.source.y}
                        x2={l.target.x}
                        y2={l.target.y}
                        stroke={isSelectedLink ? "#0b57d0" : isFocused || isHoveredLink ? (isCoAccused ? "#d93025" : "#0b57d0") : isCoAccused ? "#d93025" : "#94a3b8"}
                        strokeOpacity={isDimmed ? 0.08 : isSelectedLink || isFocused || isHoveredLink ? 1 : 0.4}
                        strokeWidth={isSelectedLink ? 3.5 : isHoveredLink || isFocused ? 2.8 : isCoAccused ? 1.8 : 1.2}
                        strokeDasharray={l.relation === "drove" || l.relation === "called" ? "5 3" : "none"}
                        className="pointer-events-none transition-all duration-200"
                      />
                    </g>
                  );
                })}

                {/* NODES */}
                {svgNodes.map(n => {
                  const typeMeta = TYPE_META[n.type as EntityType];
                  const isAccused = n.type === "accused";
                  const isVehicle = n.type === "vehicle";
                  const isVictim = n.type === "victim";
                  const r = isAccused ? 18 : isVehicle ? 16 : isVictim ? 15 : n.type === "case" ? 12 : 10;
                  const isSelected = selected === n.id;
                  const isConnected = connectedNeighborIds.has(n.id);
                  const isDimmed = activeFocusId && !isConnected;
                  const patternId = n.meta?.photo ? `pattern-${n.id.replace(/[^a-zA-Z0-9_-]/g, "_")}` : null;

                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x} ${n.y})`}
                      className="cursor-pointer transition-opacity duration-200"
                      opacity={isDimmed ? 0.2 : 1}
                      onMouseEnter={() => setHover(n.id)}
                      onMouseLeave={() => setHover(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(n.id);
                        setSelectedEdge(null);
                      }}
                    >
                      {/* Node Halo */}
                      {(isSelected || hover === n.id) && (
                        <circle r={r + 8} fill={typeMeta.color} opacity={0.25} className="animate-pulse" />
                      )}

                      {/* Node Shape / Image Mugshot / Vehicle / Victim Photo */}
                      {patternId ? (
                        <g>
                          <circle r={r + 2} fill="#ffffff" stroke={typeMeta.color} strokeWidth={isSelected ? 3.5 : 2} />
                          <circle r={r} fill={`url(#${patternId})`} />
                        </g>
                      ) : (
                        <circle r={r} fill={typeMeta.color} stroke="#ffffff" strokeWidth={2} />
                      )}

                      {/* Clean Label */}
                      <text
                        y={r + 15}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight="bold"
                        fontFamily="DM Sans, sans-serif"
                        fill="#202124"
                        className="select-none shadow-sm"
                      >
                        {t(n.label)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* FLOATING LINK INTELLIGENCE POPOVER (WHEN CLICKING ANY CONNECTION LINK) */}
          {selectedEdge && (
            <div className="absolute top-4 left-4 z-30 w-80 sm:w-96 bg-white/95 backdrop-blur-md border border-[#0b57d0]/30 rounded-2xl p-4 shadow-2xl space-y-3 text-xs animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#e8f0fe] text-[#0b57d0] border border-[#0b57d0]/20 flex items-center gap-1 uppercase tracking-wider">
                  <Fingerprint className="h-3 w-3" /> Link Connection Intelligence
                </span>
                <X className="h-4 w-4 cursor-pointer text-[#5f6368] hover:text-[#202124]" onClick={() => setSelectedEdge(null)} />
              </div>

              {/* Photos & Connection Highlight */}
              <div className="p-3 bg-[#f8f9fa] rounded-xl border border-[#dadce0] space-y-3">
                <div className="flex items-center justify-around gap-2 text-center">
                  {/* Source Entity */}
                  <div className="flex flex-col items-center gap-1 max-w-[120px]">
                    {selectedEdge.source.meta?.photo ? (
                      <img src={selectedEdge.source.meta.photo} alt={selectedEdge.source.label} className="w-14 h-14 rounded-full object-cover border-2 border-[#d93025] shadow-md" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#e8f0fe] text-[#0b57d0] flex items-center justify-center font-bold text-sm border-2 border-[#0b57d0]">
                        {selectedEdge.source.label.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold text-xs text-[#202124] truncate w-full">{selectedEdge.source.label}</span>
                    <Badge className="text-[8px] bg-white text-[#5f6368] border uppercase">{selectedEdge.source.type}</Badge>
                  </div>

                  {/* Relationship Indicator */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-[#fce8e6] text-[#d93025] flex items-center justify-center font-bold shadow-inner">
                      🔗
                    </div>
                    <span className="font-mono text-[9px] font-bold text-[#d93025] uppercase tracking-tighter">
                      {selectedEdge.relation}
                    </span>
                  </div>

                  {/* Target Entity */}
                  <div className="flex flex-col items-center gap-1 max-w-[120px]">
                    {selectedEdge.target.meta?.photo ? (
                      <img src={selectedEdge.target.meta.photo} alt={selectedEdge.target.label} className="w-14 h-14 rounded-full object-cover border-2 border-[#a142f4] shadow-md" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#fef7e0] text-[#e37400] flex items-center justify-center font-bold text-sm border-2 border-[#fde293]">
                        {selectedEdge.target.label.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold text-xs text-[#202124] truncate w-full">{selectedEdge.target.label}</span>
                    <Badge className="text-[8px] bg-white text-[#5f6368] border uppercase">{selectedEdge.target.type}</Badge>
                  </div>
                </div>

                {/* If target or source is vehicle, show travel history quick button */}
                {(selectedEdge.source.type === "vehicle" || selectedEdge.target.type === "vehicle") && (
                  <Button
                    size="sm"
                    className="w-full bg-[#a142f4] hover:bg-[#8b2fc9] text-white font-bold text-xs rounded-xl py-1.5 flex items-center justify-center gap-1.5 shadow-sm mt-2"
                    onClick={() => {
                      const vehNode = selectedEdge.source.type === "vehicle" ? selectedEdge.source : selectedEdge.target;
                      setTrackingVehicleNode(vehNode);
                      setSelectedEdge(null);
                    }}
                  >
                    <Navigation className="h-3.5 w-3.5" /> Track Vehicle Travel Movement
                  </Button>
                )}

                <div className="text-[10px] text-[#5f6368] border-t border-[#dadce0]/60 pt-2 font-mono flex items-center justify-between">
                  <span>ASSOCIATION INDEX:</span>
                  <span className="font-bold text-[#0b57d0]">HIGH CONFIDENCE (94%)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelected(selectedEdge.source.id); setSelectedEdge(null); }}
                  className="flex-1 text-[11px] font-bold h-8 border-[#dadce0] rounded-xl text-[#0b57d0]"
                >
                  Focus {selectedEdge.source.label.split(" ")[0]}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelected(selectedEdge.target.id); setSelectedEdge(null); }}
                  className="flex-1 text-[11px] font-bold h-8 border-[#dadce0] rounded-xl text-[#0b57d0]"
                >
                  Focus {selectedEdge.target.label.split(" ")[0]}
                </Button>
              </div>
            </div>
          )}

          {/* FLOATING DOSSIER DRAWER ON NODE CLICK */}
          {selectedNode && (
            <div className="absolute top-3 right-3 bottom-3 left-3 sm:left-auto z-20 w-auto sm:w-80 bg-white border border-[#dadce0] rounded-2xl p-4 shadow-xl flex flex-col overflow-y-auto space-y-4 text-xs animate-in fade-in slide-in-from-right-2">

              <div className="flex items-center justify-between border-b border-[#dadce0] pb-2">
                <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: TYPE_META[selectedNode.type].bg, color: TYPE_META[selectedNode.type].color }}>
                  {TYPE_META[selectedNode.type].label}
                </span>
                <X className="h-4 w-4 cursor-pointer text-[#5f6368] hover:text-[#202124]" onClick={() => setSelected(null)} />
              </div>

              {/* Accused Photo Header */}
              {selectedNode.type === "accused" && selectedNode.meta.photo && (
                <div className="flex items-center gap-3 p-2 bg-[#f8f9fa] rounded-xl border border-[#dadce0]">
                  <img src={selectedNode.meta.photo} alt={selectedNode.label} className="w-14 h-14 rounded-full object-cover border-2 border-[#c5221f] shadow-2xs shrink-0" />
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[#202124]">{selectedNode.label}</h3>
                    {selectedNode.meta.aliases?.[0] && (
                      <p className="text-xs text-[#1a73e8] font-medium italic">a.k.a. {selectedNode.meta.aliases[0]}</p>
                    )}
                    <span className="text-[10px] text-[#5f6368] font-medium block mt-0.5">District: {selectedNode.meta.district || "Karnataka"}</span>
                  </div>
                </div>
              )}

              {/* Victim Photo Header */}
              {selectedNode.type === "victim" && (
                <div className="flex items-center gap-3 p-2.5 bg-[#e8f0fe]/60 rounded-xl border border-[#aecbfa]">
                  {selectedNode.meta.photo ? (
                    <img src={selectedNode.meta.photo} alt={selectedNode.label} className="w-14 h-14 rounded-full object-cover border-2 border-[#1a73e8] shadow-2xs shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-base border-2 border-[#1a73e8] shrink-0">
                      {selectedNode.label.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[#202124]">{selectedNode.label}</h3>
                    <p className="text-xs text-[#1a73e8] font-medium">Victim of Recorded Crime</p>
                    <span className="text-[10px] text-[#5f6368] font-medium block mt-0.5">Age: {selectedNode.meta.age || "32"} · District: {selectedNode.meta.district || "Karnataka"}</span>
                  </div>
                </div>
              )}

              {/* Vehicle Photo Header & Travel Tracking Trigger */}
              {selectedNode.type === "vehicle" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2.5 bg-[#e8f0fe]/60 rounded-xl border border-[#aecbfa]">
                    {selectedNode.meta.photo ? (
                      <img src={selectedNode.meta.photo} alt={selectedNode.label} className="w-14 h-14 rounded-lg object-cover border border-[#aecbfa] shadow-2xs shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center font-bold text-lg border border-[#aecbfa] shrink-0">
                        <Car className="h-6 w-6" />
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden space-y-0.5">
                      <Badge className="bg-[#1a73e8] text-white text-[10px] font-mono px-2 py-0.5 mb-0.5 font-bold">{selectedNode.label}</Badge>
                      <h3 className="font-semibold text-xs text-[#202124] truncate">{selectedNode.meta.vehicleDetails?.makeModel || "Vehicle Registration"}</h3>
                      <p className="text-[10px] text-[#5f6368]">Owner: {selectedNode.meta.vehicleDetails?.ownerName || "Registered Driver"}</p>
                    </div>
                  </div>

                  {/* PROMINENT VEHICLE TRAVEL TRACKING BUTTON */}
                  <Button
                    size="sm"
                    className="w-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs rounded-lg py-2 flex items-center justify-center gap-1.5 shadow-2xs transition-all"
                    onClick={() => setTrackingVehicleNode(selectedNode)}
                  >
                    <Navigation className="h-3.5 w-3.5" /> Track Vehicle Movement & Travel History
                  </Button>
                </div>
              )}

              {/* Phone Header & CDR Call Logs Trigger */}
              {selectedNode.type === "phone" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2.5 bg-[#e0f2fe]/60 rounded-xl border border-[#bae6fd]">
                    <div className="w-14 h-14 rounded-lg bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center font-bold text-lg border border-[#bae6fd] shrink-0">
                      <PhoneCall className="h-6 w-6" />
                    </div>
                    <div className="flex-1 overflow-hidden space-y-0.5">
                      <Badge className="bg-[#0284c7] text-white text-[10px] font-mono px-2 py-0.5 mb-0.5 font-bold">{selectedNode.label}</Badge>
                      <h3 className="font-semibold text-xs text-[#202124] truncate">{selectedNode.meta.phoneDetails?.subscriberName || "Phone Subscriber"}</h3>
                      <p className="text-[10px] text-[#5f6368]">Operator: <span className="font-medium text-[#0284c7]">{selectedNode.meta.phoneDetails?.operator || "Airtel Karnataka"}</span></p>
                    </div>
                  </div>

                  {/* PROMINENT CDR CALL LOGS BUTTON */}
                  <Button
                    size="sm"
                    className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-medium text-xs rounded-lg py-2 flex items-center justify-center gap-1.5 shadow-2xs transition-all"
                    onClick={() => setTrackingPhoneNode(selectedNode)}
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> Track CDR Call Logs & Tower Intercepts
                  </Button>
                </div>
              )}

              {selectedNode.type !== "accused" && selectedNode.type !== "victim" && selectedNode.type !== "vehicle" && selectedNode.type !== "phone" && (
                <div>
                  <h3 className="font-display text-sm font-semibold text-[#202124]">{selectedNode.label}</h3>
                </div>
              )}

              {selectedNode.type === "accused" && (
                <div className="p-3 rounded-xl bg-[#fce8e6] border border-[#f8b4b0] text-[#c5221f] font-medium flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span>STATUS: WANTED SUSPECT</span>
                    <Badge className="bg-[#c5221f] text-white text-[10px]">RISK {selectedNode.meta.riskScore || 80}/100</Badge>
                  </div>
                  <div className="text-[10px] text-[#c5221f] font-mono border-t border-[#f8b4b0]/40 pt-1 flex items-center gap-1 font-semibold">
                    <span>ROLE:</span>
                    <span>
                      {(deg.get(selectedNode.id) || 0) >= 5
                        ? "🔴 SYNDICATE LEADER"
                        : (deg.get(selectedNode.id) || 0) >= 2
                          ? "🟡 GANG ASSOCIATE"
                          : "🟢 FIELD RUNNER"}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#202124]">
                <div className="p-2.5 rounded-lg bg-[#f8f9fa] border border-[#dadce0]">
                  <span className="text-[9px] uppercase font-semibold text-[#5f6368] block">District</span>
                  <span className="font-semibold text-xs">{selectedNode.meta.district || "Karnataka"}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8f9fa] border border-[#dadce0]">
                  <span className="text-[9px] uppercase font-semibold text-[#5f6368] block">Links</span>
                  <span className="font-semibold text-xs text-[#1a73e8]">{deg.get(selectedNode.id) ?? 0} Connected</span>
                </div>
              </div>

              {/* Intelligence Linkages */}
              <div className="space-y-1.5">
                <span className="text-[9px] uppercase font-semibold tracking-wider text-[#5f6368] block">Intelligence Linkages</span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {getSuspectRelations().map((rel, rIdx) => (
                    <button
                      key={rIdx}
                      onClick={() => setSelected(rel.id)}
                      className="flex items-center justify-between w-full p-2 bg-[#f8f9fa] border border-[#dadce0] hover:bg-[#e8f0fe] hover:border-[#1a73e8] rounded-lg text-left transition-colors text-[10px]"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[150px]">
                        {rel.photo ? (
                          <img src={rel.photo} alt={rel.name} className="w-4 h-4 rounded-full object-cover border border-[#dadce0] shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#1a73e8] shrink-0" />
                        )}
                        <span className="font-semibold truncate text-[#202124]">{rel.name}</span>
                      </div>
                      <Badge variant="outline" className="bg-[#e8f0fe] text-[#1a73e8] text-[8px] border-[#aecbfa] font-medium px-1.5 py-0">
                        {rel.relation}
                      </Badge>
                    </button>
                  ))}
                  {getSuspectRelations().length === 0 && (
                    <p className="text-[10px] text-[#5f6368] italic">No direct linked associates recorded.</p>
                  )}
                </div>
              </div>

              {/* AI Prediction */}
              {selectedNode.meta.predictedNext && (
                <div className="p-3 rounded-lg bg-[#fef7e0] border border-[#feefc3] text-[#202124] space-y-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-[#b06000]">
                    <Sparkles className="h-3.5 w-3.5 text-[#b06000]" /> Predicted Next Move
                  </div>
                  <p className="font-semibold text-xs">{selectedNode.meta.predictedNext.crime} in {selectedNode.meta.district || "Bengaluru"}</p>
                  <p className="text-[10px] text-[#5f6368] font-mono">{selectedNode.meta.predictedNext.probability}% Probability · {selectedNode.meta.predictedNext.window}</p>
                </div>
              )}

              <div className="pt-2 border-t border-[#dadce0]">
                <Button
                  size="sm"
                  className="w-full bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-lg font-medium text-xs h-9 flex items-center justify-center gap-1"
                  onClick={() => {
                    if (selectedNode.type === "case") {
                      const cid = selectedNode.id.replace("C-", "");
                      navigate({ to: `/cases/${cid}` });
                    } else if (selectedNode.type === "accused") {
                      navigate({ to: "/offenders" });
                    } else if (selectedNode.type === "location") {
                      navigate({ to: "/hotspots" });
                    }
                  }}
                >
                  Inspect Details <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        /* MODE C: STRUCTURED LINK DIRECTORY MATRIX (WITH VEHICLE & VICTIM PHOTOS) */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNodes.map(n => {
            const t = TYPE_META[n.type as EntityType];
            const d = deg.get(n.id) ?? 0;
            const isSelected = selected === n.id;

            return (
              <Card
                key={n.id}
                onClick={() => setSelected(n.id)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative overflow-hidden",
                  isSelected ? "border-[#0b57d0] bg-[#e8f0fe]/40 shadow-sm ring-1 ring-[#0b57d0]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: t.bg, color: t.color }}>
                    <t.Icon className="h-3 w-3" /> {t.label}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[#5f6368]">{d} Link(s)</span>
                </div>

                <div className="flex items-center gap-3">
                  {n.meta.photo ? (
                    <img
                      src={n.meta.photo}
                      alt={n.label}
                      className={cn(
                        "w-11 h-11 rounded-full object-cover border shadow-2xs shrink-0",
                        n.type === "accused" ? "border-[#c5221f]" : "border-[#1a73e8]"
                      )}
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-center font-bold text-xs shrink-0">
                      {n.label.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden flex-1">
                    <h4 className="font-semibold text-sm text-[#202124] truncate">{n.label}</h4>
                    <p className="text-xs text-[#5f6368]">District: {n.meta.district || "Karnataka"}</p>
                    {n.type === "vehicle" && n.meta.vehicleDetails?.makeModel && (
                      <p className="text-[10px] text-[#1a73e8] font-medium truncate">{n.meta.vehicleDetails.makeModel}</p>
                    )}
                  </div>
                </div>

                {n.type === "accused" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold">
                      <span className="text-[#5f6368]">Criminal Risk Score</span>
                      <span className="text-[#c5221f]">{n.meta.riskScore || 75}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#f1f3f4] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#f9ab00] to-[#c5221f]" style={{ width: `${n.meta.riskScore || 75}%` }} />
                    </div>
                  </div>
                )}

                {n.type === "vehicle" && (
                  <Button
                    size="sm"
                    className="w-full bg-[#e8f0fe] hover:bg-[#1557b0] text-[#1a73e8] hover:text-white font-medium text-xs rounded-lg h-8 flex items-center justify-center gap-1 border border-[#aecbfa]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrackingVehicleNode(n);
                    }}
                  >
                    <Navigation className="h-3.5 w-3.5" /> Track Travel History
                  </Button>
                )}

                {n.type === "phone" && (
                  <Button
                    size="sm"
                    className="w-full bg-[#e0f2fe] hover:bg-[#0284c7] text-[#0284c7] hover:text-white font-bold text-[11px] rounded-xl h-7 flex items-center justify-center gap-1 border border-[#7dd3fc]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrackingPhoneNode(n);
                    }}
                  >
                    <PhoneCall className="h-3 w-3" /> Track CDR Call Logs
                  </Button>
                )}

                <div className="pt-2 border-t border-[#dadce0] flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-[#5f6368]">ID: {n.id}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(n.id);
                      setViewMode("graph");
                    }}
                    className="h-6 px-2 text-[11px] font-bold text-[#0b57d0]"
                  >
                    Focus Graph <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VEHICLE MOVEMENT & ANPR TRAVEL HISTORY TRACKER MODAL              */}
      {/* ------------------------------------------------------------------ */}
      {trackingVehicleNode && (() => {
        const targetPlate = trackingVehicleNode.meta.plate || trackingVehicleNode.label;
        const fallbackInfo = getUniqueVehicleDetails(0, targetPlate);
        const vehCategory = trackingVehicleNode.meta.vehicleDetails?.category || fallbackInfo.vehicleDetails.category || "Vehicle";
        const vehMakeModel = trackingVehicleNode.meta.vehicleDetails?.makeModel || fallbackInfo.vehicleDetails.makeModel;
        const vehColor = trackingVehicleNode.meta.vehicleDetails?.color || fallbackInfo.vehicleDetails.color;
        const vehOwner = trackingVehicleNode.meta.vehicleDetails?.ownerName || fallbackInfo.vehicleDetails.ownerName;

        const travelLogs: TravelCheckpoint[] = (trackingVehicleNode.meta.travelHistory && trackingVehicleNode.meta.travelHistory.length > 0)
          ? trackingVehicleNode.meta.travelHistory
          : createTravelHistory(targetPlate, trackingVehicleNode.meta.district || "Bengaluru Urban", undefined, trackingVehicleNode.meta.photo);

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white border border-[#dadce0] rounded-2xl max-w-4xl w-full p-6 shadow-xl space-y-6 relative max-h-[90vh] overflow-y-auto">

              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-[#dadce0] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center font-semibold text-lg border border-[#aecbfa]">
                    <Car className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#1a73e8] text-white text-xs font-mono px-2.5 py-0.5 font-bold">
                        {targetPlate}
                      </Badge>
                      <Badge variant="outline" className="bg-[#f1f3f4] text-[#3c4043] border-[#dadce0] text-[10px] font-semibold uppercase">
                        {vehCategory}
                      </Badge>
                      <Badge variant="outline" className="bg-[#fce8e6] text-[#c5221f] border-[#f8b4b0] text-[10px] font-semibold">
                        ANPR Hotlisted
                      </Badge>
                    </div>
                    <h2 className="text-lg font-display font-semibold text-[#202124] mt-1">
                      Vehicle Telemetry & ANPR Scans
                    </h2>
                    <p className="text-xs text-[#5f6368]">
                      License Plate: <span className="font-mono font-semibold text-[#202124]">{targetPlate}</span> · Real-Time ANPR Camera Surveillance Feed
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTrackingVehicleNode(null)}
                  className="h-8 w-8 p-0 rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Vehicle Specs Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-4">
                {/* Image Snapshot */}
                <div className="relative rounded-lg overflow-hidden border border-[#dadce0] h-32 bg-slate-900 flex items-center justify-center">
                  {trackingVehicleNode.meta.photo ? (
                    <img src={trackingVehicleNode.meta.photo} alt={targetPlate} className="w-full h-full object-cover" />
                  ) : (
                    <Car className="h-12 w-12 text-slate-500" />
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/75 text-white font-mono text-[9px] font-medium px-2 py-0.5 rounded flex items-center gap-1">
                    <Eye className="h-3 w-3 text-[#1a73e8]" /> CCTV Snapshot
                  </div>
                </div>

                {/* Specs */}
                <div className="space-y-1 text-xs text-[#202124]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f6368] block">Registered Vehicle Details</span>
                  <p className="font-semibold text-sm text-[#1a73e8]">
                    {vehMakeModel}
                  </p>
                  <p><span className="text-[#5f6368]">Category:</span> <span className="font-medium text-[#202124]">{vehCategory}</span></p>
                  <p><span className="text-[#5f6368]">Plate Number:</span> <span className="font-mono font-semibold text-[#202124]">{targetPlate}</span></p>
                  <p><span className="text-[#5f6368]">Color:</span> {vehColor}</p>
                  <p><span className="text-[#5f6368]">Owner:</span> {vehOwner}</p>
                </div>

                {/* Quick Metrics */}
                <div className="space-y-2 bg-white border border-[#dadce0] rounded-lg p-3 flex flex-col justify-between text-xs">
                  <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-1.5">
                    <span className="text-[#5f6368] font-medium">Scanned Plate:</span>
                    <span className="font-mono font-semibold text-[#1a73e8]">{targetPlate}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-1.5">
                    <span className="text-[#5f6368] font-medium">Camera Scans:</span>
                    <span className="font-mono font-semibold text-[#202124]">{travelLogs.length} Checkpoints</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-1.5">
                    <span className="text-[#5f6368] font-medium">Distance Covered:</span>
                    <span className="font-mono font-semibold text-[#202124]">184 km</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5f6368] font-medium">Active Status:</span>
                    <Badge variant="outline" className="bg-[#fce8e6] text-[#c5221f] border-[#f8b4b0] text-[9px] font-medium">ANPR TRACKING</Badge>
                  </div>
                </div>
              </div>

              {/* Travel Path Sequence */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5f6368] flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-[#1a73e8]" /> Travel Sequence Path
                </h3>

                <div className="bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-3.5 flex items-center justify-between overflow-x-auto gap-3">
                  {travelLogs.map((cp, idx) => (
                    <div key={idx} className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-7 h-7 rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-semibold text-xs shadow-xs">
                          {idx + 1}
                        </div>
                        <span className="font-medium text-xs text-[#202124] mt-1 max-w-[100px] truncate">{cp.district}</span>
                        <span className="font-mono text-[9px] text-[#5f6368]">{cp.timestamp.split(" ")[1]}</span>
                      </div>
                      {idx < travelLogs.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-[#1a73e8] shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ANPR Camera Scans List (Clean Google Workspace Data Table) */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5f6368] flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-[#1a73e8]" /> ANPR Camera Scans ({travelLogs.length})
                </h3>

                <div className="border border-[#dadce0] rounded-xl overflow-hidden max-h-[340px] overflow-y-auto overflow-x-auto w-full">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8f9fa] border-b border-[#dadce0] sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368] text-center w-12">Scan</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Checkpoint Location</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">District</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Timestamp</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Speed & Match</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Occupants</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dadce0] bg-white">
                      {travelLogs.map((cp: TravelCheckpoint, idx: number) => (
                        <tr key={idx} className="hover:bg-[#f8f9fa] transition-colors">
                          <td className="py-2.5 px-3 text-center font-bold text-[#1a73e8]">#{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-[#202124] block">{cp.locationName}</span>
                            <span className="text-[10px] text-[#5f6368] font-mono">{cp.cameraType} · {cp.checkpointId}</span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#202124]">{cp.district}</td>
                          <td className="py-2.5 px-3 font-mono text-[#1a73e8] font-medium">{cp.timestamp}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-semibold text-[#202124]">{cp.speedKmph} km/h</span>
                            <span className="text-[10px] text-[#5f6368] block font-mono">ANPR: {cp.anprConfidence}%</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="bg-[#f1f3f4] text-[#3c4043] px-2 py-0.5 rounded border border-[#dadce0] font-mono text-[10px]">
                              {(cp.occupantsDetected || []).join(", ") || "Driver Only"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="bg-[#fce8e6] text-[#c5221f] border-[#f8b4b0] text-[9px] font-medium">
                              {cp.flagStatus}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Police Action Bar */}
              <div className="pt-4 border-t border-[#dadce0] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-[#c5221f] hover:bg-[#a50e0c] text-white font-medium text-xs rounded-lg h-9 px-4 shadow-2xs"
                    onClick={() => toast.success(`Hotlist Alert for vehicle ${targetPlate} broadcast to all PCR Vans & Checkposts!`)}
                  >
                    <Radio className="mr-1.5 h-3.5 w-3.5" /> Broadcast Hotlist Alert
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs rounded-lg h-9 px-4 shadow-2xs flex items-center gap-1.5"
                    onClick={() => {
                      const headers = [
                        "Checkpoint ID",
                        "Location / Toll Plaza",
                        "District",
                        "Timestamp",
                        "Speed (km/h)",
                        "Camera / ANPR Type",
                        "ANPR Match (%)",
                        "Occupants Detected",
                        "Flag Status",
                        "Latitude",
                        "Longitude"
                      ];
                      const rows = travelLogs.map(cp => [
                        cp.checkpointId,
                        cp.locationName,
                        cp.district,
                        cp.timestamp,
                        cp.speedKmph,
                        cp.cameraType,
                        `${cp.anprConfidence}%`,
                        (cp.occupantsDetected || []).join(" | "),
                        cp.flagStatus,
                        cp.coords.lat,
                        cp.coords.lng
                      ]);
                      exportToCsv(`ANPR_Vehicle_Movement_Log_${targetPlate.replace(/[^A-Z0-9]/g, "")}.csv`, headers, rows);
                      toast.success(`Exported ANPR Travel CSV for ${targetPlate}`);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> Export ANPR Logs (CSV)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#dadce0] text-[#3c4043] hover:bg-[#f1f3f4] font-medium text-xs rounded-lg h-9 px-4"
                    onClick={() => {
                      exportVehiclePdfReport(targetPlate, { makeModel: vehMakeModel, ownerName: vehOwner, category: vehCategory, district: trackingVehicleNode.meta.district }, travelLogs);
                      toast.success(`Generated Official ANPR PDF Forensic Report for ${targetPlate}`);
                    }}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5 text-[#1a73e8]" /> Export PDF Report
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTrackingVehicleNode(null)}
                  className="text-xs font-medium text-[#5f6368] hover:text-[#202124]"
                >
                  Close Window
                </Button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ------------------------------------------------------------------ */}
      {/* PHONE CALL LOGS (CDR) & TOWER INTERCEPT TRACKER MODAL              */}
      {/* ------------------------------------------------------------------ */}
      {trackingPhoneNode && (() => {
        const targetPhone = trackingPhoneNode.meta.number || trackingPhoneNode.label;
        const subscriber = trackingPhoneNode.meta.phoneDetails?.subscriberName || "Suspect Subscriber";
        const operator = trackingPhoneNode.meta.phoneDetails?.operator || "Airtel Karnataka";
        const circle = trackingPhoneNode.meta.phoneDetails?.circle || "Karnataka Circle";
        const imei = trackingPhoneNode.meta.phoneDetails?.imei || "864902047132984";
        const districtName = trackingPhoneNode.meta.district || "Bengaluru Urban";

        const subscriberPhoto = trackingPhoneNode.meta.photo || 
          (trackingPhoneNode.meta.phoneDetails as any)?.photo ||
          (CASES || []).flatMap((c: any) => c.accused || []).find((a: any) => a.name && subscriber && (a.name.toLowerCase().includes(subscriber.toLowerCase()) || subscriber.toLowerCase().includes(a.name.toLowerCase())))?.photo ||
          (OFFENDERS || []).find((o: any) => o.name && subscriber && (o.name.toLowerCase().includes(subscriber.toLowerCase()) || subscriber.toLowerCase().includes(o.name.toLowerCase())))?.photo ||
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80";

        const callLogs: CallLogEntry[] = (trackingPhoneNode.meta.callLogs && trackingPhoneNode.meta.callLogs.length > 0)
          ? trackingPhoneNode.meta.callLogs
          : createCallLogs(targetPhone, districtName, subscriber);

        const flaggedCallsCount = callLogs.filter(c => c.callStatus === "Intercept Flagged" || c.type === "Encrypted VOIP").length;
        const totalDurationSec = callLogs.reduce((acc, c) => acc + c.durationSeconds, 0);
        const totalDurationMin = Math.round(totalDurationSec / 60);

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white border border-[#dadce0] rounded-2xl max-w-4xl w-full p-6 shadow-xl space-y-6 relative max-h-[90vh] overflow-y-auto">

              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-[#dadce0] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center font-semibold text-lg border border-[#bae6fd]">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#0284c7] text-white text-xs font-mono px-2.5 py-0.5 font-bold">
                        {targetPhone}
                      </Badge>
                      <Badge variant="outline" className="bg-[#e0f2fe] text-[#0284c7] border-[#bae6fd] text-[10px] font-semibold uppercase">
                        10-Digit CDR Intercept
                      </Badge>
                      {flaggedCallsCount > 0 && (
                        <Badge variant="outline" className="bg-[#fce8e6] text-[#c5221f] border-[#f8b4b0] text-[10px] font-semibold flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> {flaggedCallsCount} Flagged Intercept(s)
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-lg font-display font-semibold text-[#202124] mt-1">
                      Call Detail Records (CDR) & Intercept Feed
                    </h2>
                    <p className="text-xs text-[#5f6368]">
                      Subscriber Line: <span className="font-mono font-semibold text-[#202124]">{targetPhone}</span> · Real-Time Telecom Tower Intercept Logs
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTrackingPhoneNode(null)}
                  className="h-8 w-8 p-0 rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Phone Subscriber Specs & Overview Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-4">
                {/* Card Info with Subscriber Photo */}
                <div className="bg-white border border-[#dadce0] rounded-lg p-3 flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#bae6fd] bg-slate-100 shrink-0 shadow-xs">
                    <img 
                      src={subscriberPhoto} 
                      alt={subscriber} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[7.5px] font-bold text-center py-0.5 uppercase tracking-tighter">
                      SUBSCRIBER
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between h-full">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0284c7] block mb-0.5">Subscriber Identity</span>
                      <h3 className="font-semibold text-sm text-[#202124] truncate">{subscriber}</h3>
                      <p className="font-mono font-semibold text-xs text-[#0284c7] mt-0.5">{targetPhone}</p>
                    </div>
                    <div className="pt-1.5 border-t border-[#f1f3f4] flex items-center justify-between text-[10px] text-[#5f6368] mt-1">
                      <span>Operator: <strong className="text-[#202124] font-medium">{operator}</strong></span>
                      <span>Status: <strong className="text-[#137333] font-medium">Active SIM</strong></span>
                    </div>
                  </div>
                </div>

                {/* Technical Hardware Specs */}
                <div className="space-y-1 text-xs text-[#202124]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5f6368] block">Hardware & Network Info</span>
                  <p><span className="text-[#5f6368]">Target Line:</span> <span className="font-mono font-semibold text-[#0284c7]">{targetPhone}</span></p>
                  <p><span className="text-[#5f6368]">IMEI Identifier:</span> <span className="font-mono font-semibold text-[#1a73e8]">{imei}</span></p>
                  <p><span className="text-[#5f6368]">Circle / Hub:</span> {circle}</p>
                  <p><span className="text-[#5f6368]">District Tower:</span> {districtName}</p>
                </div>

                {/* Quick Metrics */}
                <div className="space-y-2 bg-white border border-[#dadce0] rounded-lg p-3 flex flex-col justify-between text-xs">
                  <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-1.5">
                    <span className="text-[#5f6368] font-medium">Total CDR Records:</span>
                    <span className="font-mono font-semibold text-[#0284c7]">{callLogs.length} Records</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-1.5">
                    <span className="text-[#5f6368] font-medium">Total Talk Time:</span>
                    <span className="font-mono font-semibold text-[#1a73e8]">{totalDurationMin} mins</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#f1f3f4] pb-1.5">
                    <span className="text-[#5f6368] font-medium">Flagged Intercepts:</span>
                    <span className="font-mono font-semibold text-[#c5221f]">{flaggedCallsCount} Intercepts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5f6368] font-medium">Tower Intercept:</span>
                    <Badge variant="outline" className="bg-[#e0f2fe] text-[#0284c7] border-[#bae6fd] text-[9px] font-medium">CDR Synced</Badge>
                  </div>
                </div>
              </div>

              {/* CDR Call Logs Feed (Clean Google Workspace Data Table) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5f6368] flex items-center gap-1.5">
                    <PhoneCall className="h-3.5 w-3.5 text-[#0284c7]" /> CDR Chronological Call Feed ({callLogs.length})
                  </h3>
                  <span className="text-[10px] text-[#5f6368] font-mono">{targetPhone}</span>
                </div>

                <div className="border border-[#dadce0] rounded-xl overflow-hidden max-h-[320px] overflow-y-auto overflow-x-auto w-full">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8f9fa] border-b border-[#dadce0] sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368] text-center w-12">Call</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Type</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Target Contact Number</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Contact Name / Role</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Cell Tower & District</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Timestamp</th>
                        <th className="py-2.5 px-3 text-[10px] uppercase font-bold text-[#5f6368]">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dadce0] bg-white">
                      {callLogs.map((log, idx) => (
                        <tr
                          key={log.callId}
                          className={cn(
                            "hover:bg-[#f8f9fa] transition-colors",
                            (log.callStatus === "Intercept Flagged" || log.type === "Encrypted VOIP") && "bg-[#fce8e6]/20"
                          )}
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-[#0284c7]">#{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-mono font-medium px-2 py-0.5",
                              log.type === "Incoming" ? "bg-[#e6f4ea] text-[#137333] border-[#ceead6]" :
                                log.type === "Outgoing" ? "bg-[#e8f0fe] text-[#1a73e8] border-[#aecbfa]" :
                                  log.type === "Encrypted VOIP" ? "bg-[#fce8e6] text-[#c5221f] border-[#f8b4b0]" : "bg-[#fef7e0] text-[#b06000] border-[#feefc3]"
                            )}>
                              {log.type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#202124]">{log.otherPartyNumber}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-[#202124] block">{log.otherPartyName}</span>
                            {log.callStatus === "Intercept Flagged" && (
                              <span className="text-[9px] font-bold text-[#c5221f] uppercase tracking-wider block">Flagged Intercept</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-[#202124] block">{log.towerLocation}</span>
                            <span className="text-[10px] text-[#5f6368]">{log.district} · {log.towerId}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#1a73e8] font-medium">{log.timestamp}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#0284c7]">
                            {log.durationSeconds > 0 ? `${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s` : "0s (No Ans)"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Police Action Bar */}
              <div className="pt-4 border-t border-[#dadce0] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-[#0284c7] hover:bg-[#0369a1] text-white font-medium text-xs rounded-lg h-9 px-4 shadow-2xs flex items-center gap-1.5"
                    onClick={() => {
                      const headers = [
                        "Call ID",
                        "Timestamp",
                        "Call Type",
                        "Target Contact Number",
                        "Contact Name / Role",
                        "Duration (Seconds)",
                        "Tower ID",
                        "Tower Location",
                        "District",
                        "Subscriber IMEI",
                        "Call Intercept Status",
                        "Latitude",
                        "Longitude"
                      ];
                      const rows = callLogs.map(log => [
                        log.callId,
                        log.timestamp,
                        log.type,
                        log.otherPartyNumber,
                        log.otherPartyName,
                        log.durationSeconds,
                        log.towerId,
                        log.towerLocation,
                        log.district,
                        log.imei,
                        log.callStatus,
                        log.coords.lat,
                        log.coords.lng
                      ]);
                      exportToCsv(`CDR_Call_Logs_${targetPhone.replace(/[^0-9]/g, "")}.csv`, headers, rows);
                      toast.success(`Exported CDR Call Detail Records CSV for ${targetPhone}`);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> Export CDR Logs (CSV)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#dadce0] text-[#3c4043] hover:bg-[#f1f3f4] font-medium text-xs rounded-lg h-9 px-4"
                    onClick={() => {
                      exportPhonePdfReport(targetPhone, subscriber, operator, imei, districtName, callLogs);
                      toast.success(`Generated Official CDR PDF Forensic Report for ${targetPhone}`);
                    }}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5 text-[#0284c7]" /> Export PDF Report
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTrackingPhoneNode(null)}
                  className="text-xs font-medium text-[#5f6368] hover:text-[#202124]"
                >
                  Close Window
                </Button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
