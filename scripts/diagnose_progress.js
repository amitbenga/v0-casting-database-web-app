import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Get a project with lines
  const { data: projects } = await supabase
    .from("casting_projects")
    .select("id, name")
    .limit(3)

  for (const project of projects || []) {
    console.log(`\n=== Project: ${project.name} (${project.id}) ===`)

    // Check script_lines
    const { data: lines, error: linesErr } = await supabase
      .from("script_lines")
      .select("id, role_name, role_id, rec_status")
      .eq("project_id", project.id)
      .limit(20)

    if (linesErr) {
      console.log("  script_lines error:", linesErr.message)
      continue
    }

    const total = lines?.length ?? 0
    const withRoleId = lines?.filter((l) => l.role_id).length ?? 0
    const recorded = lines?.filter((l) => l.rec_status === "הוקלט").length ?? 0

    console.log(`  script_lines (first 20): total=${total}, with_role_id=${withRoleId}, recorded=${recorded}`)

    // Check project_scripts
    const { data: scripts } = await supabase
      .from("project_scripts")
      .select("id, name")
      .eq("project_id", project.id)

    console.log(`  project_scripts: ${scripts?.length ?? 0}`)

    // Check project_roles
    const { data: roles } = await supabase
      .from("project_roles")
      .select("id, role_name")
      .eq("project_id", project.id)
      .limit(10)

    console.log(`  project_roles (first 10): ${roles?.length ?? 0}`)

    // Check view
    const { data: summary } = await supabase
      .from("project_summary")
      .select("*")
      .eq("id", project.id)
      .single()

    if (summary) {
      console.log(`  project_summary view:`)
      console.log(`    roles_count=${summary.roles_count}`)
      console.log(`    scripts_count=${summary.scripts_count}`)
      console.log(`    total_lines=${summary.total_lines}`)
      console.log(`    recorded_lines=${summary.recorded_lines}`)
    }
  }
}

main().catch(console.error)
