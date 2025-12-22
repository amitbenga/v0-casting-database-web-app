"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"

const SKILLS_OPTIONS = ["משחק", "שירה", "ריקוד", "אומנויות לחימה", "אקרובטיקה", "מוזיקה", "קומדיה", "דרמה"]

const LANGUAGES_OPTIONS = ["עברית", "אנגלית", "ערבית", "רוסית", "צרפתית", "ספרדית", "גרמנית", "איטלקית"]

export default function ActorIntakePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploadedPhoto, setUploadedPhoto] = useState<string>("")
  const [uploadedAudio, setUploadedAudio] = useState<string>("")
  const [skills, setSkills] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])

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

      // יצירת אובייקט השחקן
      const actorData = {
        full_name: formData.full_name,
        email: formData.email || null,
        phone: formData.phone || null,
        gender: formData.gender,
        birth_year: formData.birth_year ? Number.parseInt(formData.birth_year) : null,
        notes: formData.notes || null,
        is_singer: formData.is_singer,
        is_course_graduate: formData.is_course_graduate,
        vat_status: formData.vat_status || null,
        skills: skills.length > 0 ? skills : null,
        languages: languages.length > 0 ? languages : null,
        photo_url: uploadedPhoto || null,
        audio_url: uploadedAudio || null,
      }

      const { error } = await supabase.from("actors").insert([actorData])

      if (error) throw error

      alert("השחקן נוסף בהצלחה!")
      router.push("/")
    } catch (error) {
      console.error("[v0] Error creating actor:", error)
      alert("שגיאה בהוספת שחקן")
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">Actor Intake Form</h1>
                <p className="text-sm text-muted-foreground">
                  Step {currentStep} of {totalSteps}
                </p>
              </div>
            </div>

            <Button variant="outline" onClick={() => router.push("/")}>
              Save Draft
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step}
                  </div>
                  {step < totalSteps && (
                    <div className={`flex-1 h-1 mx-2 ${step < currentStep ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Personal</span>
              <span>Skills & Languages</span>
              <span>Photos & Audio</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Personal Information</h2>
                  <p className="text-sm text-muted-foreground">Tell us about yourself</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="John Doe"
                      required
                      dir="rtl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@example.com"
                        dir="ltr"
                        className="text-right"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                        dir="ltr"
                        className="text-right"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender *</Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value) => setFormData({ ...formData, gender: value })}
                      >
                        <SelectTrigger dir="rtl">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="birth_year">Birth Year *</Label>
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
                        className="text-right"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vat_status">VAT Status</Label>
                      <Select
                        value={formData.vat_status}
                        onValueChange={(value) => setFormData({ ...formData, vat_status: value })}
                      >
                        <SelectTrigger dir="rtl">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="exempt">Exempt</SelectItem>
                          <SelectItem value="not_applicable">Not Applicable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label>Flags</Label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.is_singer}
                            onChange={(e) => setFormData({ ...formData, is_singer: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Singer</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.is_course_graduate}
                            onChange={(e) => setFormData({ ...formData, is_course_graduate: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Course Graduate</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes..."
                      className="min-h-[100px]"
                      dir="rtl"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Step 2: Skills & Languages */}
            {currentStep === 2 && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Skills & Languages</h2>
                  <p className="text-sm text-muted-foreground">Choose your skills and languages</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Skills</Label>
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
                  </div>

                  <div className="space-y-3">
                    <Label>Languages</Label>
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
                  </div>
                </div>
              </Card>
            )}

            {/* Step 3: Photos & Audio */}
            {currentStep === 3 && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Photos & Audio</h2>
                  <p className="text-sm text-muted-foreground">Upload your profile photo and audio file</p>
                </div>

                <div className="space-y-6">
                  {/* Photo */}
                  <div className="space-y-3">
                    <Label>Profile Photo</Label>
                    {uploadedPhoto ? (
                      <div className="relative w-48 h-48 mx-auto">
                        <img
                          src={uploadedPhoto || "/placeholder.svg"}
                          alt="Preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 left-2"
                          onClick={() => setUploadedPhoto("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-12 text-center">
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <Label htmlFor="photo" className="cursor-pointer">
                          <div className="text-sm text-muted-foreground mb-2">Click to upload photo</div>
                          <Input
                            id="photo"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoUpload}
                          />
                          <Button type="button" variant="outline" size="sm">
                            Choose Photo
                          </Button>
                        </Label>
                      </div>
                    )}
                  </div>

                  {/* Audio */}
                  <div className="space-y-3">
                    <Label>Audio File</Label>
                    {uploadedAudio ? (
                      <div className="space-y-3">
                        <audio controls className="w-full" dir="ltr">
                          <source src={uploadedAudio} />
                        </audio>
                        <Button type="button" variant="outline" size="sm" onClick={() => setUploadedAudio("")}>
                          <X className="h-4 w-4 ml-2" />
                          Remove File
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <Label htmlFor="audio" className="cursor-pointer">
                          <div className="text-sm text-muted-foreground mb-2">Click to upload audio file</div>
                          <Input
                            id="audio"
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={handleAudioUpload}
                          />
                          <Button type="button" variant="outline" size="sm">
                            Choose Audio File
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
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button type="button" onClick={nextStep} disabled={!canProceed()}>
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={loading || !canProceed()}>
                  {loading ? "Submitting..." : "Submit Actor"}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
