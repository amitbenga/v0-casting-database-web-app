import * as XLSX from "xlsx";
import type { ProjectRoleWithCasting } from "@/lib/types";

/**
 * ייצוא ליהוק לאקסל
 * כל תפקיד בשורה עם השחקן המשובץ
 */
export async function exportCastingToExcel(
  roles: ProjectRoleWithCasting[],
  projectName: string
) {
  try {
    // Flatten roles including children
    const allRoles: ProjectRoleWithCasting[] = [];
    for (const role of roles) {
      allRoles.push(role);
      if (role.children) {
        allRoles.push(...role.children);
      }
    }

    // הכנת הנתונים - כל תפקיד = שורה (תפקיד עם מרובה שחקנים = מרובה שורות)
    const data: Record<string, string | number>[] = []
    for (const role of allRoles) {
      if (role.castings.length === 0) {
        data.push({
          "תפקיד": role.role_name,
          "סוג": role.parent_role_id ? "גרסה" : "ראשי",
          "רפליקות": role.replicas_count || role.replicas_needed || 0,
          "שחקן": "לא משובץ",
          "סטטוס": "—",
          "קשור לתפקיד": role.parent_role_id ? allRoles.find(r => r.id === role.parent_role_id)?.role_name || "—" : "—",
          "מקור": role.source || "ידני",
        })
      } else {
        for (const casting of role.castings) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const actor = (casting as any).actor
          data.push({
            "תפקיד": role.role_name,
            "סוג": role.parent_role_id ? "גרסה" : "ראשי",
            "רפליקות": role.replicas_count || role.replicas_needed || 0,
            "שחקן": actor?.full_name || "שחקן",
            "סטטוס": casting.status || "—",
            "קשור לתפקיד": role.parent_role_id ? allRoles.find(r => r.id === role.parent_role_id)?.role_name || "—" : "—",
            "מקור": role.source || "ידני",
          })
        }
      }
    }

    const ws = XLSX.utils.json_to_sheet(data);
    
    // הגדרת רוחב עמודות
    ws["!cols"] = [
      { wch: 30 }, // תפקיד
      { wch: 10 }, // סוג
      { wch: 10 }, // רפליקות
      { wch: 25 }, // שחקן
      { wch: 12 }, // סטטוס
      { wch: 25 }, // קשור לתפקיד
      { wch: 15 }, // מקור
    ];

    // יצירת חוברת
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ליהוק");

    // הוסף גיליון שני עם סטטיסטיקות
    const assignedCount = allRoles.filter(r => r.castings.length > 0).length;
    const stats = {
      "סה״כ תפקידים": allRoles.length,
      "תפקידים ראשיים": allRoles.filter(r => !r.parent_role_id).length,
      "גרסאות": allRoles.filter(r => r.parent_role_id).length,
      "משובצים": assignedCount,
      "לא משובצים": allRoles.length - assignedCount,
      "סה״כ רפליקות": allRoles.reduce((sum, r) => sum + (r.replicas_count || r.replicas_needed || 0), 0),
    };

    const statsWs = XLSX.utils.json_to_sheet(
      Object.entries(stats).map(([key, value]) => ({
        "מדד": key,
        "ערך": value,
      }))
    );
    statsWs["!cols"] = [
      { wch: 25 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, statsWs, "סטטיסטיקות");

    // שמירה
    const cleanName = projectName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_") || "casting";
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    
    // הורדה
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ליהוק_${cleanName}_${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error("Error exporting casting:", error);
    throw new Error("שגיאה בייצוא ליהוק: " + (error instanceof Error ? error.message : "לא ידוע"));
  }
}

/**
 * ייבוא תפקידים מאקסל
 * מצפה לעמודות: תפקיד, רפליקות (אופציונלי)
 * 
 * החוזר: array של תפקידים שחולצו
 */
export async function importCastingFromExcel(file: File): Promise<{
  roles: Array<{ role_name: string; replicas_count: number }>;
  warnings: string[];
}> {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    
    if (!workbook.SheetNames.length) {
      throw new Error("הקובץ לא מכיל גיליונות");
    }

    // קרא את הגיליון הראשון
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (!rows.length) {
      throw new Error("הגיליון ריק");
    }

    const warnings: string[] = [];
    const roles: Array<{ role_name: string; replicas_count: number }> = [];

    // חלץ תפקידים מהשורות
    rows.forEach((row, index) => {
      // מצא את שם התפקיד
      const roleNameKey = Object.keys(row).find(
        (key) =>
          key.toLowerCase().includes("תפקיד") ||
          key.toLowerCase().includes("role") ||
          key.toLowerCase().includes("character")
      );

      if (!roleNameKey || !row[roleNameKey]) {
        warnings.push(`שורה ${index + 2}: לא נמצא שם תפקיד`);
        return;
      }

      const roleName = String(row[roleNameKey]).trim().toUpperCase();

      // מצא את מספר הרפליקות
      const replicasKey = Object.keys(row).find(
        (key) =>
          key.toLowerCase().includes("רפליקה") ||
          key.toLowerCase().includes("replica") ||
          key.toLowerCase().includes("count") ||
          key.toLowerCase().includes("מופעים")
      );

      let replicas = 1; // ברירת מחדל
      if (replicasKey && row[replicasKey]) {
        const parsed = parseInt(String(row[replicasKey]), 10);
        replicas = isNaN(parsed) ? 1 : Math.max(1, parsed);
      }

      roles.push({
        role_name: roleName,
        replicas_count: replicas,
      });
    });

    if (!roles.length) {
      throw new Error("לא נחלצו תפקידים מהקובץ");
    }

    return { roles, warnings };
  } catch (error) {
    console.error("Error importing casting:", error);
    throw new Error("שגיאה בייבוא ליהוק: " + (error instanceof Error ? error.message : "לא ידוע"));
  }
}

/**
 * ייצוא תפקידים לאקסל (קובץ טמפלט לייבוא)
 * משמש כדוגמה למשתמש איך להכין קובץ אקסל
 */
export function exportCastingTemplate(projectName: string) {
  try {
    const templateData = [
      { "תפקיד": "KING ALDRIC", "רפליקות": 187 },
      { "תפקיד": "QUEEN ELARA", "רפליקות": 156 },
      { "תפקיד": "PRINCE ROWAN", "רפליקות": 234 },
      { "תפקיד": "SHADOW LORD", "רפליקות": 142 },
      { "תפקיד": "CAPTAIN THORNE", "רפליקות": 112 },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 30 },
      { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "תפקידים");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `template_casting_${projectName || "project"}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error("Error exporting template:", error);
    throw new Error("שגיאה בייצוא דוגמה: " + (error instanceof Error ? error.message : "לא ידוע"));
  }
}
