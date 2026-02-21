"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { SKILLS_LIST, LANGUAGES_LIST, VAT_STATUS_LABELS, DUBBING_EXPERIENCE_RANGES, SINGING_STYLES_LIST, type SingingStyle, type FilterState } from "@/lib/types"

interface FilterPanelProps {
  onFilterChange?: (filters: FilterState) => void
}

export function FilterPanel({ onFilterChange }: FilterPanelProps) {
  const currentYear = new Date().getFullYear()

  const [filters, setFilters] = useState<FilterState>({
    gender: [],
    ageMin: 18,
    ageMax: 80,
    isSinger: null,
    isCourseGrad: null,
    skills: [],
    languages: [],
    vatStatus: [],
    sortBy: "shuffle",
    dubbingExperience: [],
    singingStyles: [],
  })

  const updateFilters = (newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters }
    setFilters(updated)
    onFilterChange?.(updated)
  }

  const handleGenderChange = (gender: string, checked: boolean) => {
    const newGender = checked ? [...filters.gender, gender] : filters.gender.filter((g) => g !== gender)
    updateFilters({ gender: newGender })
  }

  const handleSkillChange = (skillKey: string, checked: boolean) => {
    const newSkills = checked ? [...filters.skills, skillKey] : filters.skills.filter((s) => s !== skillKey)
    updateFilters({ skills: newSkills })
  }

  const handleLanguageChange = (langKey: string, checked: boolean) => {
    const newLanguages = checked ? [...filters.languages, langKey] : filters.languages.filter((l) => l !== langKey)
    updateFilters({ languages: newLanguages })
  }

  const handleVatChange = (vatKey: string, checked: boolean) => {
    const newVat = checked ? [...filters.vatStatus, vatKey] : filters.vatStatus.filter((v) => v !== vatKey)
    updateFilters({ vatStatus: newVat })
  }

  const handleDubbingExperienceChange = (rangeKey: string, checked: boolean) => {
    const newRanges = checked 
      ? [...filters.dubbingExperience, rangeKey] 
      : filters.dubbingExperience.filter((r) => r !== rangeKey)
    updateFilters({ dubbingExperience: newRanges })
  }

  const handleSingingStyleChange = (style: SingingStyle, checked: boolean) => {
    const newStyles = checked 
      ? [...filters.singingStyles, style] 
      : filters.singingStyles.filter((s) => s !== style)
    updateFilters({ singingStyles: newStyles })
  }

  return (
    <Card className="p-3 md:p-4 md:sticky md:top-4">
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm md:text-base">סינון</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const defaultFilters: FilterState = {
                gender: [],
                ageMin: 18,
                ageMax: 80,
                isSinger: null,
                isCourseGrad: null,
                skills: [],
                languages: [],
                vatStatus: [],
                sortBy: "shuffle",
                dubbingExperience: [],
                singingStyles: [],
              }
              setFilters(defaultFilters)
              onFilterChange?.(defaultFilters)
            }}
            className="text-xs md:text-sm h-8"
          >
            נקה הכל
          </Button>
        </div>

        <Separator />

        <Accordion type="multiple" defaultValue={["gender", "age", "skills", "languages"]} className="w-full">
          <AccordionItem value="gender">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">מין</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 md:space-y-3">
                {[
                  { key: "male", label: "זכר" },
                  { key: "female", label: "נקבה" },
                ].map((gender) => (
                  <div key={gender.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`gender-${gender.key}`}
                      checked={filters.gender.includes(gender.key)}
                      onCheckedChange={(checked) => handleGenderChange(gender.key, checked as boolean)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`gender-${gender.key}`} className="text-xs md:text-sm font-normal cursor-pointer">
                      {gender.label}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="age">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">טווח גילאים</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="text-xs md:text-sm text-muted-foreground text-center font-medium">
                  {filters.ageMin} - {filters.ageMax} שנים
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">גיל מינימלי: {filters.ageMin}</Label>
                    <Slider
                      min={5}
                      max={100}
                      step={1}
                      value={[filters.ageMin]}
                      onValueChange={(value) => updateFilters({ ageMin: value[0] })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">גיל מקסימלי: {filters.ageMax}</Label>
                    <Slider
                      min={5}
                      max={100}
                      step={1}
                      value={[filters.ageMax]}
                      onValueChange={(value) => updateFilters({ ageMax: value[0] })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dubbing">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">ניסיון בדיבוב (בשנים)</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 md:space-y-3">
                {DUBBING_EXPERIENCE_RANGES.map((range) => (
                  <div key={range.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`dubbing-${range.key}`}
                      checked={filters.dubbingExperience.includes(range.key)}
                      onCheckedChange={(checked) => handleDubbingExperienceChange(range.key, checked as boolean)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`dubbing-${range.key}`} className="text-xs md:text-sm font-normal cursor-pointer">
                      {range.label}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="singing-styles">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">סגנונות שירה</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 md:space-y-3 max-h-48 overflow-y-auto">
                {SINGING_STYLES_LIST.filter(style => style.key !== "other").map((style) => (
                  <div key={style.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`singing-style-${style.key}`}
                      checked={filters.singingStyles.includes(style.key)}
                      onCheckedChange={(checked) => handleSingingStyleChange(style.key, checked as boolean)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`singing-style-${style.key}`} className="text-xs md:text-sm font-normal cursor-pointer">
                      {style.label}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="singer">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">זמר/ת</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is-singer"
                    checked={filters.isSinger === true}
                    onCheckedChange={(checked) => updateFilters({ isSinger: checked ? true : null })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is-singer" className="text-xs md:text-sm font-normal cursor-pointer">
                    רק זמרים
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="not-singer"
                    checked={filters.isSinger === false}
                    onCheckedChange={(checked) => updateFilters({ isSinger: checked ? false : null })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="not-singer" className="text-xs md:text-sm font-normal cursor-pointer">
                    רק לא זמרים
                  </Label>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="graduate">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">בוגר קורס</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is-grad"
                    checked={filters.isCourseGrad === true}
                    onCheckedChange={(checked) => updateFilters({ isCourseGrad: checked ? true : null })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is-grad" className="text-xs md:text-sm font-normal cursor-pointer">
                    רק בוגרי קורס
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="not-grad"
                    checked={filters.isCourseGrad === false}
                    onCheckedChange={(checked) => updateFilters({ isCourseGrad: checked ? false : null })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="not-grad" className="text-xs md:text-sm font-normal cursor-pointer">
                    רק לא בוגרי קורס
                  </Label>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="skills">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">כישורים</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 md:space-y-3 max-h-48 overflow-y-auto">
                {SKILLS_LIST.map((skill) => (
                  <div key={skill.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`skill-${skill.key}`}
                      checked={filters.skills.includes(skill.key)}
                      onCheckedChange={(checked) => handleSkillChange(skill.key, checked as boolean)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`skill-${skill.key}`} className="text-xs md:text-sm font-normal cursor-pointer">
                      {skill.label}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="languages">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">שפות</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 md:space-y-3 max-h-48 overflow-y-auto">
                {LANGUAGES_LIST.map((language) => (
                  <div key={language.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`lang-${language.key}`}
                      checked={filters.languages.includes(language.key)}
                      onCheckedChange={(checked) => handleLanguageChange(language.key, checked as boolean)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`lang-${language.key}`} className="text-xs md:text-sm font-normal cursor-pointer">
                      {language.label}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="vat">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">מעמד במע״מ</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 md:space-y-3">
                {Object.entries(VAT_STATUS_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`vat-${key}`}
                      checked={filters.vatStatus.includes(key)}
                      onCheckedChange={(checked) => handleVatChange(key, checked as boolean)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`vat-${key}`} className="text-xs md:text-sm font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sort">
            <AccordionTrigger className="text-xs md:text-sm font-medium py-2 md:py-3">מיון</AccordionTrigger>
            <AccordionContent>
              <RadioGroup
                value={filters.sortBy}
                onValueChange={(value) => updateFilters({ sortBy: value as FilterState["sortBy"] })}
                className="space-y-2 md:space-y-3"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="shuffle" id="sort-shuffle" />
                  <Label htmlFor="sort-shuffle" className="text-xs md:text-sm font-normal cursor-pointer">
                    שאפל (ברירת מחדל)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="newest" id="sort-newest" />
                  <Label htmlFor="sort-newest" className="text-xs md:text-sm font-normal cursor-pointer">
                    חדשים ראשון
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="alphabetical" id="sort-alpha" />
                  <Label htmlFor="sort-alpha" className="text-xs md:text-sm font-normal cursor-pointer">
                    אלפביתי (א׳-ת׳)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="age-asc" id="sort-age-asc" />
                  <Label htmlFor="sort-age-asc" className="text-xs md:text-sm font-normal cursor-pointer">
                    גיל (צעירים ראשון)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="age-desc" id="sort-age-desc" />
                  <Label htmlFor="sort-age-desc" className="text-xs md:text-sm font-normal cursor-pointer">
                    גיל (מבוגרים ראשון)
                  </Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Card>
  )
}
