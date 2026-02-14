"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { normalizeEmail, normalizePhone } from "@/lib/normalizers"

const SKILLS_OPTIONS = ["משחק", "שירה", "ריקוד", "אומנויות לחימה", "אקרובטיקה", "מוזיקה", "קומדיה", "דרמה", "אחר"]

const LANGUAGES_OPTIONS = ["עברית", "אנגלית", "ערבית", "רוסית", "צרפתית", "ספרדית", "גרמנית", "איטלקית", "אחר"]

const ACCENTS_OPTIONS = [
  { key: "french", label: "צרפתי" },
  { key: "italian", label: "איטלקי" },
  { key: "spanish", label: "ספרדי" },
  { key: "german", label: "גרמני" },
]

export default function ActorIntakePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploadedPhoto, setUploadedPhoto] = useState<string>("")
  const [uploadedAudio, setUploadedAudio] = useState<string>("")
  const [uploadedSinging, setUploadedSinging] = useState<string>("")
  const [accents, setAccents] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [skillsOther, setSkillsOther] = useState<string>("")
  const [languagesOther, setLanguagesOther] = useState<string>("")

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    gender: "",
    birth_year: "",
    notes: "",
    is_singer: false,
    is_course_graduate: false,
    vat_status: "",
  })

  const totalSteps = 3

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedPhoto(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedAudio(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSingingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedSinging(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const toggleAccent = (accent: string) => {
    setAccents((prev) => (prev.includes(accent) ? prev.filter((a) => a !== accent) : [...prev, accent]))
  }

  const toggleSkill = (skill: string) => {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))
  }

  const toggleLanguage = (language: string) => {
    setLanguages((prev) => (prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createBrowserClient()

      const submissionData = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        normalized_email: normalizeEmail(formData.email),
        normalized_phone: normalizePhone(formData.phone),
        gender: formData.gender,
        birth_year: formData.birth_year ? Number.parseInt(formData.birth_year) : null,
        notes: formData.notes || null,
        is_singer: formData.is_singer,
        is_course_graduate: formData.is_course_graduate,
        vat_status: formData.vat_status || null,
        skills: skills.length > 0 ? skills : null,
        skills_other: skillsOther || null,
        languages: languages.length > 0 ? languages : null,
        languages_other: languagesOther || null,
        image_url: uploadedPhoto || null,
        voice_sample_url: uploadedAudio || null,
        singing_sample_url: uploadedSinging || null,
        accents: accents.length > 0 ? accents : [],
        review_status: "pending",
        match_status: "pending",
        matched_actor_id: null,
        raw_payload: {
          ...formData,
          skills,
          skills_other: skillsOther,
          languages,
          languages_other: languagesOther,
          submitted_at: new Date().toISOString(),
        },
      }

      const { error } = await supabase.from("actor_submissions").insert([submissionData])

      if (error) throw error

      alert("הבקשה נשלחה בהצלחה! היא תיבדק ותאושר בקרוב.")
      router.push("/")
    } catch (error) {
      console.error("[v0] Error submitting actor:", error)
      alert("שגיאה בשליחת הבקשה")
    } finally {
      setLoading(false)
    }
  }

  const nextStep = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const canProceed = () => {
    if (currentStep === 1) {
      return formData.full_name && formData.gender && formData.birth_year
    }
    return true
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">טופס קליטת שחקן</h1>
                <p className="text-sm text-muted-foreground">
                  שלב {currentStep} מתוך {totalSteps}
                </p>
              </div>
            </div>

            <Button variant="outline" onClick={() => router.push("/")}>
              שמור טיוטה
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[
                { num: 1, label: "פרטים אישיים" },
                { num: 2, label: "כישורים ושפות" },
                { num: 3, label: "תמונות וקול" },
              ].map((step, index) => (
                <div key={step.num} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        step.num <= currentStep
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step.num}
                    </div>
                    <span
                      className={`text-xs mt-2 ${step.num <= currentStep ? "text-primary font-medium" : "text-muted-foreground"}`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < 2 && (
                    <div className={`flex-1 h-1 mx-4 ${step.num < currentStep ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">פרטים אישיים</h2>
                  <p className="text-sm text-muted-foreground">ספר/י לנו על עצמך</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">שם מלא *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="ישראל ישראלי"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">טלפון</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="050-1234567"
                        dir="ltr"
                        className="text-left"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">אימייל</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="example@email.com"
                        dir="ltr"
                        className="text-left"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="birth_year">שנת לידה *</Label>
                      <Input
                        id="birth_year"
                        type="number"
                        min="1900"
                        max={new Date().getFullYear()}
                        value={formData.birth_year}
                        onChange={(e) => setFormData({ ...formData, birth_year: e.target.value })}
                        placeholder="1990"
                        required
                        dir="ltr"
                        className="text-left"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender">מין *</Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value) => setFormData({ ...formData, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר מין" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">זכר</SelectItem>
                          <SelectItem value="female">נקבה</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label>סימונים</Label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.is_singer}
                            onChange={(e) => setFormData({ ...formData, is_singer: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">זמר/ית</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.is_course_graduate}
                            onChange={(e) => setFormData({ ...formData, is_course_graduate: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">בוגר/ת קורס</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vat_status">מעמד במע"מ</Label>
                      <Select
                        value={formData.vat_status}
                        onValueChange={(value) => setFormData({ ...formData, vat_status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר מעמד" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="licensed">עוסק מורשה</SelectItem>
                          <SelectItem value="exempt">עוסק פטור</SelectItem>
                          <SelectItem value="none">לא רשום</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">הערות</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="הערות נוספות..."
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Step 2: Skills & Languages */}
            {currentStep === 2 && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">כישורים ושפות</h2>
                  <p className="text-sm text-muted-foreground">בחר/י את הכישורים והשפות שלך</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>כישורים</Label>
                    <div className="flex flex-wrap gap-2">
                      {SKILLS_OPTIONS.map((skill) => (
                        <Badge
                          key={skill}
                          variant={skills.includes(skill) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleSkill(skill)}
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                    {skills.includes("אחר") && (
                      <div className="mt-2">
                        <Input
                          value={skillsOther}
                          onChange={(e) => setSkillsOther(e.target.value)}
                          placeholder="פרט כישורים נוספים..."
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>שפות</Label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES_OPTIONS.map((language) => (
                        <Badge
                          key={language}
                          variant={languages.includes(language) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleLanguage(language)}
                        >
                          {language}
                        </Badge>
                      ))}
                    </div>
                    {languages.includes("אחר") && (
                      <div className="mt-2">
                        <Input
                          value={languagesOther}
                          onChange={(e) => setLanguagesOther(e.target.value)}
                          placeholder="פרט שפות נוספות..."
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>מבטאים</Label>
                    <div className="flex flex-wrap gap-2">
                      {ACCENTS_OPTIONS.map((accent) => (
                        <Badge
                          key={accent.key}
                          variant={accents.includes(accent.key) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleAccent(accent.key)}
                        >
                          {accent.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Step 3: Photos & Audio */}
            {currentStep === 3 && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">תמונות וקול</h2>
                  <p className="text-sm text-muted-foreground">העלה תמונת פרופיל וקובץ קול</p>
                </div>

                <div className="space-y-6">
                  {/* Photo */}
                  <div className="space-y-3">
                    <Label>תמונת פרופיל</Label>
                    {uploadedPhoto ? (
                      <div className="relative w-48 h-48 mx-auto">
                        <img
                          src={uploadedPhoto || "/placeholder.svg"}
                          alt="תצוגה מקדימה"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => setUploadedPhoto("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-12 text-center">
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <Label htmlFor="photo" className="cursor-pointer">
                          <div className="text-sm text-muted-foreground mb-2">לחץ להעלאת תמונה</div>
                          <Input
                            id="photo"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoUpload}
                          />
                          <Button type="button" variant="outline" size="sm">
                            בחר תמונה
                          </Button>
                        </Label>
                      </div>
                    )}
                  </div>

                  {/* Voice Sample (Spoken) */}
                  <div className="space-y-3">
                    <Label>קובץ קול (דיבור)</Label>
                    {uploadedAudio ? (
                      <div className="space-y-3">
                        <audio controls className="w-full" dir="ltr">
                          <source src={uploadedAudio} />
                        </audio>
                        <Button type="button" variant="outline" size="sm" onClick={() => setUploadedAudio("")}>
                          <X className="h-4 w-4 ml-2" />
                          הסר קובץ
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <Label htmlFor="audio" className="cursor-pointer">
                          <div className="text-sm text-muted-foreground mb-2">לחץ להעלאת קובץ קול</div>
                          <Input
                            id="audio"
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={handleAudioUpload}
                          />
                          <Button type="button" variant="outline" size="sm">
                            בחר קובץ קול
                          </Button>
                        </Label>
                      </div>
                    )}
                  </div>

                  {/* Singing Sample */}
                  <div className="space-y-3">
                    <Label>קובץ קול (שירה)</Label>
                    {uploadedSinging ? (
                      <div className="space-y-3">
                        <audio controls className="w-full" dir="ltr">
                          <source src={uploadedSinging} />
                        </audio>
                        <Button type="button" variant="outline" size="sm" onClick={() => setUploadedSinging("")}>
                          <X className="h-4 w-4 ml-2" />
                          הסר קובץ
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <Label htmlFor="singing" className="cursor-pointer">
                          <div className="text-sm text-muted-foreground mb-2">לחץ להעלאת קובץ שירה</div>
                          <Input
                            id="singing"
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={handleSingingUpload}
                          />
                          <Button type="button" variant="outline" size="sm">
                            בחר קובץ שירה
                          </Button>
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-6">
              <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 1}>
                הקודם
              </Button>

              {currentStep < totalSteps ? (
                <Button type="button" onClick={nextStep} disabled={!canProceed()}>
                  הבא
                </Button>
              ) : (
                <Button type="submit" disabled={loading || !canProceed()}>
                  {loading ? "שומר..." : "הוסף שחקן"}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
