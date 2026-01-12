import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { Actor } from "@/lib/types";

/**
 * ייצוא שחקן בודד ל-PDF
 * Note: jsPDF doesn't support Hebrew well, so we'll use a workaround with reversed text
 */
export const exportActorToPDF = (actor: Actor) => {
  const doc = new jsPDF();

  // כותרת באנגלית
  doc.setFontSize(20);
  doc.text("Actor Profile", 105, 20, { align: "center" });

  // פרטי השחקן - נשתמש באנגלית כדי להימנע מבעיות עם עברית
  const currentYear = new Date().getFullYear();
  const age = currentYear - actor.birth_year;

  const data = [
    ["Full Name", actor.full_name],
    ["Gender", actor.gender === "male" ? "Male" : "Female"],
    ["Age", `${age} (Born ${actor.birth_year})`],
    ["Phone", actor.phone],
    ["Email", actor.email || "N/A"],
    ["City", actor.city || "N/A"],
    ["Singer", actor.is_singer ? "Yes" : "No"],
    ["Course Graduate", actor.is_course_grad ? "Yes" : "No"],
    ["VAT Status", actor.vat_status],
    [
      "Skills",
      actor.skills.length > 0 ? actor.skills.map((s) => s.label).join(", ") : "N/A",
    ],
    [
      "Languages",
      actor.languages.length > 0 ? actor.languages.map((l) => l.label).join(", ") : "N/A",
    ],
    ["Notes", actor.notes || "N/A"],
  ];

  autoTable(doc, {
    startY: 30,
    head: [["Field", "Value"]],
    body: data,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
      halign: "left",
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: 130 },
    },
  });

  // שמירת הקובץ
  const filename = actor.full_name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  doc.save(`actor_${filename}.pdf`);
};

/**
 * ייצוא מספר שחקנים ל-PDF
 */
export const exportActorsToPDF = (actors: Actor[], filename: string = "actors") => {
  const doc = new jsPDF();

  // כותרת
  doc.setFontSize(20);
  doc.text("Actors List", 105, 20, { align: "center" });

  // הכנת הנתונים
  const currentYear = new Date().getFullYear();
  const tableData = actors.map((actor) => [
    actor.full_name,
    actor.gender === "male" ? "M" : "F",
    `${currentYear - actor.birth_year}`,
    actor.phone,
    actor.email || "N/A",
    actor.is_singer ? "Yes" : "No",
    actor.vat_status,
  ]);

  autoTable(doc, {
    startY: 30,
    head: [["Name", "Gender", "Age", "Phone", "Email", "Singer", "VAT"]],
    body: tableData,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      halign: "left",
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 15, halign: "center" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 25 },
      4: { cellWidth: 40 },
      5: { cellWidth: 15, halign: "center" },
      6: { cellWidth: 25 },
    },
  });

  // שמירת הקובץ
  const cleanFilename = filename.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  doc.save(`${cleanFilename}.pdf`);
};

/**
 * ייצוא שחקן בודד ל-Excel
 */
export const exportActorToExcel = (actor: Actor) => {
  const currentYear = new Date().getFullYear();
  const age = currentYear - actor.birth_year;

  const data = [
    { שדה: "שם מלא", ערך: actor.full_name },
    { שדה: "מין", ערך: actor.gender === "male" ? "זכר" : "נקבה" },
    { שדה: "גיל", ערך: `${age} (נולד ${actor.birth_year})` },
    { שדה: "טלפון", ערך: actor.phone },
    { שדה: "אימייל", ערך: actor.email || "לא זמין" },
    { שדה: "עיר", ערך: actor.city || "לא זמין" },
    { שדה: "זמר/ת", ערך: actor.is_singer ? "כן" : "לא" },
    { שדה: "בוגר/ת קורס", ערך: actor.is_course_grad ? "כן" : "לא" },
    { שדה: "סטטוס מעמ", ערך: actor.vat_status },
    {
      שדה: "כישורים",
      ערך: actor.skills.length > 0 ? actor.skills.map((s) => s.label).join(", ") : "לא זמין",
    },
    {
      שדה: "שפות",
      ערך: actor.languages.length > 0 ? actor.languages.map((l) => l.label).join(", ") : "לא זמין",
    },
    { שדה: "הערות", ערך: actor.notes || "לא זמין" },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  
  // הגדרת רוחב עמודות
  ws["!cols"] = [
    { wch: 20 }, // שדה
    { wch: 50 }, // ערך
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "פרופיל שחקן");

  const filename = actor.full_name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  XLSX.writeFile(wb, `actor_${filename}.xlsx`);
};

/**
 * ייצוא מספר שחקנים ל-Excel
 */
export const exportActorsToExcel = (actors: Actor[], filename: string = "actors") => {
  const currentYear = new Date().getFullYear();

  const data = actors.map((actor) => ({
    "שם מלא": actor.full_name,
    "מין": actor.gender === "male" ? "זכר" : "נקבה",
    "גיל": currentYear - actor.birth_year,
    "שנת לידה": actor.birth_year,
    "טלפון": actor.phone,
    "אימייל": actor.email || "לא זמין",
    "עיר": actor.city || "לא זמין",
    "זמר/ת": actor.is_singer ? "כן" : "לא",
    "בוגר/ת קורס": actor.is_course_grad ? "כן" : "לא",
    "סטטוס מעמ": actor.vat_status,
    "כישורים": actor.skills.length > 0 ? actor.skills.map((s) => s.label).join(", ") : "לא זמין",
    "שפות": actor.languages.length > 0 ? actor.languages.map((l) => l.label).join(", ") : "לא זמין",
    "הערות": actor.notes || "לא זמין",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  
  // הגדרת רוחב עמודות
  ws["!cols"] = [
    { wch: 25 }, // שם מלא
    { wch: 10 }, // מין
    { wch: 8 },  // גיל
    { wch: 12 }, // שנת לידה
    { wch: 15 }, // טלפון
    { wch: 30 }, // אימייל
    { wch: 15 }, // עיר
    { wch: 10 }, // זמר/ת
    { wch: 15 }, // בוגר/ת קורס
    { wch: 15 }, // סטטוס מעמ
    { wch: 40 }, // כישורים
    { wch: 30 }, // שפות
    { wch: 50 }, // הערות
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "שחקנים");

  const cleanFilename = filename.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  XLSX.writeFile(wb, `${cleanFilename}.xlsx`);
};

/**
 * ייצוא שחקן בודד - בחירת פורמט
 */
export const exportActor = (actor: Actor, format: "pdf" | "excel") => {
  if (format === "pdf") {
    exportActorToPDF(actor);
  } else {
    exportActorToExcel(actor);
  }
};

/**
 * ייצוא מספר שחקנים - בחירת פורמט
 */
export const exportActors = (actors: Actor[], format: "pdf" | "excel", filename?: string) => {
  if (format === "pdf") {
    exportActorsToPDF(actors, filename);
  } else {
    exportActorsToExcel(actors, filename);
  }
};
