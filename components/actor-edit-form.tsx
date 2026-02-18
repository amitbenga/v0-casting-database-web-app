"use client"

import type React from "react"
import { useState, useRef } from "react"
import { ArrowRight, Save, Upload, X, MusicIcon, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { SKILLS_LIST, LANGUAGES_LIST, VAT_STATUS_LABELS, SINGING_STYLE_LEVEL_LABELS, SINGING_STYLES_LIST, type Actor, type SingingStyleLevel, type SingingStyle, type SingingStyleOther, type SingingStyleWithLevel } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface ActorEditFormProps {
  actor: Actor
  onSave: (actor: Actor) => void
  onCancel: () => void
}

export function ActorEditForm({ actor, onSave, onCancel }: ActorEditFormProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState(actor)
  const [imagePreview, setImagePreview] = useState(actor.image_url)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const voiceInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("actors")
        .update({
          full_name: formData.full_name,
          gender: formData.gender,
          birth_year: formData.birth_year,
          phone: formData.phone,
          email: formData.email,
          city: formData.city,
          is_singer: formData.is_singer,
          is_course_grad: formData.is_course_grad,
          vat_status: formData.vat_status,
          image_url: formData.image_url,
          voice_sample_url: formData.voice_sample_url,
          notes: formData.notes,
          skills: formData.skills,
          languages: formData.languages,
          other_lang_text: formData.other_lang_text,
          // שדות חדשים - דיבוב ושירה
          dubbing_experience_years: formData.dubbing_experience_years || 0,
          singing_styles: formData.singing_styles || [],
          singing_styles_other: formData.singing_styles_other || [],
          singing_sample_url: formData.singing_sample_url || "",
          youtube_link: formData.youtube_link || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", actor.id)

      if (error) {
        console.error("[v0] Error updating actor:", error)
        toast({ title: "שגיאה", description: "שגיאה בשמירת השינויים", variant: "destructive" })
        return
      }

      console.log("[v0] Actor updated successfully")
      onSave(formData)
    } catch (error) {
      console.error("[v0] Error:", error)
      toast({ title: "שגיאה", description: "שגיאה בשמירת השינויים", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setImagePreview(result)
        handleChange("image_url", result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImagePreview("")
    handleChange("image_url", "")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        handleChange("voice_sample_url", result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveVoice = () => {
    handleChange("voice_sample_url", "")
    if (voiceInputRef.current) {
      voiceInputRef.current.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onCancel} disabled={saving}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl md:text-2xl font-semibold">עריכת פרופיל</h1>
                <p className="text-sm text-muted-foreground">{actor.full_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={saving}
                className="flex-1 md:flex-none bg-transparent"
              >
                ביטול
              </Button>
              <Button onClick={handleSubmit} disabled={saving} className="flex-1 md:flex-none">
                <Save className="h-4 w-4 ml-2" />
                {saving ? "שומר..." : "שמור"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
          {/* Image Upload */}
          <Card className="p-4 md:p-6 space-y-4">
            <h3 className="font-semibold">תמונה</h3>
            <Separator />

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0">
                <div className="w-full md:w-48 aspect-[3/4] overflow-hidden bg-muted rounded-lg border-2 border-dashed relative">
                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview || "/placeholder.svg"}
                        alt="תצוגה מקדימה"
                        className="h-full w-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 left-2"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <p className="text-sm text-muted-foreground text-center px-4">אין תמונה</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground">העלה תמונת פרופיל של השחקן</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full md:w-auto"
                >
                  <Upload className="h-4 w-4 ml-2" />
                  העלה תמונה
                </Button>
                <p className="text-xs text-muted-foreground">פורמטים נתמכים: JPG, PNG, WEBP</p>
              </div>
            </div>
          </Card>

          {/* Voice Sample Upload */}
          <Card className="p-4 md:p-6 space-y-4">
            <h3 className="font-semibold">קובץ קול</h3>
            <Separator />

            <div className="space-y-4">
              {formData.voice_sample_url && (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MusicIcon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">קובץ קול קיים</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={handleRemoveVoice}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <audio controls className="w-full">
                    <source src={formData.voice_sample_url} />
                    הדפדפן שלך לא תומך בהשמעת קבצי שמע.
                  </audio>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">העלה דוגמת קול של השחקן</p>
                <input
                  ref={voiceInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleVoiceUpload}
                  className="hidden"
                  id="voice-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => voiceInputRef.current?.click()}
                  className="w-full md:w-auto"
                >
                  <Upload className="h-4 w-4 ml-2" />
                  {formData.voice_sample_url ? "החלף קובץ קול" : "העלה קובץ קול"}
                </Button>
                <p className="text-xs text-muted-foreground">פורמטים נתמכים: MP3, WAV, M4A</p>
              </div>
            </div>
          </Card>

          {/* Basic Information */}
          <Card className="p-4 md:p-6 space-y-6">
            <h3 className="font-semibold">מידע בסיסי</h3>
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">שם מלא *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">מין *</Label>
                <Select value={formData.gender} onValueChange={(value) => handleChange("gender", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">זכר</SelectItem>
                    <SelectItem value="female">נקבה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birth_year">שנת לידה *</Label>
                <Input
                  id="birth_year"
                  type="number"
                  value={formData.birth_year}
                  onChange={(e) => handleChange("birth_year", Number.parseInt(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">טלפון *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">עיר</Label>
                <Input id="city" value={formData.city || ""} onChange={(e) => handleChange("city", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">הערות / ניסיון</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                className="min-h-[100px]"
                placeholder="הזן הערות או ניסיון מקצועי..."
              />
            </div>
          </Card>

          {/* Statuses */}
          <Card className="p-4 md:p-6 space-y-6">
            <h3 className="font-semibold">סטטוסים</h3>
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_singer"
                  checked={formData.is_singer}
                  onCheckedChange={(checked) => handleChange("is_singer", checked)}
                />
                <Label htmlFor="is_singer" className="cursor-pointer">
                  זמר/ת
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_course_grad"
                  checked={formData.is_course_grad}
                  onCheckedChange={(checked) => handleChange("is_course_grad", checked)}
                />
                <Label htmlFor="is_course_grad" className="cursor-pointer">
                  בוגר/ת קורס
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vat_status">מעמד במע״מ</Label>
                <Select value={formData.vat_status} onValueChange={(value) => handleChange("vat_status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VAT_STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Dubbing Experience */}
          <Card className="p-4 md:p-6 space-y-6">
            <h3 className="font-semibold">ניסיון בדיבוב</h3>
            <Separator />

            <div className="space-y-2">
              <Label htmlFor="dubbing_experience_years">ניסיון בדיבוב (בשנים)</Label>
              <Input
                id="dubbing_experience_years"
                type="number"
                min="0"
                value={formData.dubbing_experience_years || 0}
                onChange={(e) => handleChange("dubbing_experience_years", Number.parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </Card>

          {/* Singing Styles */}
          <Card className="p-4 md:p-6 space-y-6">
            <h3 className="font-semibold">סגנונות שירה</h3>
            <Separator />

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">בחר סגנונות שירה והגדר רמה לכל סגנון</p>
              
              <div className="space-y-3">
                {SINGING_STYLES_LIST.filter(style => style.key !== "other").map((style) => {
                  const currentStyles = (formData.singing_styles || []) as unknown as SingingStyleWithLevel[]
                  const existingStyle = currentStyles.find((s) => s.style === style.key)
                  const isSelected = !!existingStyle

                  return (
                    <div key={style.key} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Checkbox
                        id={`singing-style-${style.key}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleChange("singing_styles", [...currentStyles, { style: style.key, level: "basic" as SingingStyleLevel }])
                          } else {
                            handleChange("singing_styles", currentStyles.filter((s) => s.style !== style.key))
                          }
                        }}
                      />
                      <Label htmlFor={`singing-style-${style.key}`} className="cursor-pointer text-sm flex-1">
                        {style.label}
                      </Label>
                      {isSelected && (
                        <Select
                          value={existingStyle.level}
                          onValueChange={(value) => {
                            const newStyles = currentStyles.map((s) =>
                              s.style === style.key ? { ...s, level: value as SingingStyleLevel } : s
                            )
                            handleChange("singing_styles", newStyles)
                          }}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SINGING_STYLE_LEVEL_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Other singing styles */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label>סגנונות שירה נוספים (אחר)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentOther = formData.singing_styles_other || []
                      handleChange("singing_styles_other", [...currentOther, { name: "", level: "basic" as SingingStyleLevel }])
                    }}
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    הוסף
                  </Button>
                </div>
                
                {(formData.singing_styles_other || []).map((item: SingingStyleOther, index: number) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Input
                      value={item.name}
                      onChange={(e) => {
                        const newOther = [...(formData.singing_styles_other || [])]
                        newOther[index] = { ...newOther[index], name: e.target.value }
                        handleChange("singing_styles_other", newOther)
                      }}
                      placeholder="שם הסגנון"
                      className="flex-1"
                    />
                    <Select
                      value={item.level}
                      onValueChange={(value) => {
                        const newOther = [...(formData.singing_styles_other || [])]
                        newOther[index] = { ...newOther[index], level: value as SingingStyleLevel }
                        handleChange("singing_styles_other", newOther)
                      }}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SINGING_STYLE_LEVEL_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newOther = (formData.singing_styles_other || []).filter((_: SingingStyleOther, i: number) => i !== index)
                        handleChange("singing_styles_other", newOther)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Skills */}
          <Card className="p-4 md:p-6 space-y-6">
            <h3 className="font-semibold">כישורים</h3>
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SKILLS_LIST.map((skill) => (
                <div key={skill.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`skill-${skill.id}`}
                    checked={(formData.skills ?? []).some((s) => s.id === skill.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleChange("skills", [...(formData.skills ?? []), skill])
                      } else {
                        handleChange(
                          "skills",
                          (formData.skills ?? []).filter((s) => s.id !== skill.id),
                        )
                      }
                    }}
                  />
                  <Label htmlFor={`skill-${skill.id}`} className="cursor-pointer text-sm">
                    {skill.label}
                  </Label>
                </div>
              ))}
            </div>
          </Card>

          {/* Languages */}
          <Card className="p-4 md:p-6 space-y-6">
            <h3 className="font-semibold">שפות</h3>
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {LANGUAGES_LIST.map((language) => (
                <div key={language.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`lang-${language.id}`}
                    checked={(formData.languages ?? []).some((l) => l.id === language.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleChange("languages", [...(formData.languages ?? []), language])
                      } else {
                        handleChange(
                          "languages",
                          (formData.languages ?? []).filter((l) => l.id !== language.id),
                        )
                      }
                    }}
                  />
                  <Label htmlFor={`lang-${language.id}`} className="cursor-pointer text-sm">
                    {language.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="other_lang_text">שפות נוספות (טקסט חופשי)</Label>
              <Input
                id="other_lang_text"
                value={formData.other_lang_text || ""}
                onChange={(e) => handleChange("other_lang_text", e.target.value)}
                placeholder='לדוגמה: "צרפתית ברמה בינונית"'
              />
            </div>
          </Card>

          {/* Submit Buttons - Mobile */}
          <div className="flex gap-2 md:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 bg-transparent"
              disabled={saving}
            >
              ביטול
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              <Save className="h-4 w-4 ml-2" />
              שמור שינויים
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
