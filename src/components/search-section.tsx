import { useState } from "react"
import { SearchInput } from "@/components/ui/search-input"
import { ResultCard } from "@/components/result-card"
import { supabase } from "@/integrations/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { Loader2, SearchX } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Result {
  name: string
  no: number
  category?: number | null
  grade?: number | null
  rank?: number | null
}

interface ResultWithRank extends Result {
  calculatedRank?: number
}
export function SearchSection() {
  const [searchTerm, setSearchTerm] = useState("")
  const [shouldSearch, setShouldSearch] = useState(false)
  
  const { data: results, isLoading, error } = useQuery<ResultWithRank[]>({
    queryKey: ['results', searchTerm, shouldSearch],
    queryFn: async () => {
      if (!searchTerm.trim() || !shouldSearch) return []
      
      // تنظيف النص المدخل وإزالة المسافات الزائدة
      const cleanSearchTerm = searchTerm.trim()
      
      // التحقق من وجود اسمين على الأقل
      const words = cleanSearchTerm.split(' ').filter(word => word.length > 0)
      if (words.length < 2) {
        throw new Error('يجب إدخال الاسم الأول والثاني على الأقل')
      }
      
      // البحث بطرق متعددة لضمان العثور على النتائج
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .ilike('name', `%${cleanSearchTerm}%`)
        .limit(1) // عرض نتيجة واحدة فقط
      
      // إذا لم نجد نتائج، نجرب البحث بالكلمات المنفصلة
      if (data && data.length === 0 && cleanSearchTerm.includes(' ')) {
        const words = cleanSearchTerm.split(' ').filter(word => word.length > 0)
        const searchPattern = words.join('%')
        
        const { data: alternativeData, error: altError } = await supabase
          .from('results')
          .select('*')
          .ilike('name', `%${searchPattern}%`)
          .limit(1) // عرض نتيجة واحدة فقط
        
        if (altError) throw altError
        
        // حساب الترتيب للنتائج البديلة
        if (alternativeData && alternativeData.length > 0) {
          const resultWithRank = await calculateRankForResult(alternativeData[0])
          return [resultWithRank]
        }
        return []
      }
      
      if (error) throw error
      
      // حساب الترتيب للنتيجة المعثور عليها
      if (data && data.length > 0) {
        const resultWithRank = await calculateRankForResult(data[0])
        return [resultWithRank]
      }
      
      return []
    },
    enabled: searchTerm.trim().split(' ').filter(word => word.length > 0).length >= 2 && shouldSearch
  })

  // دالة لحساب الترتيب حسب الفئة
  const calculateRankForResult = async (result: Result): Promise<ResultWithRank> => {
    if (!result.category || !result.grade) {
      return { ...result, calculatedRank: undefined }
    }

    // جلب جميع النتائج في نفس الفئة مرتبة حسب الدرجة تنازلياً
    const { data: categoryResults, error } = await supabase
      .from('results')
      .select('grade, name')
      .eq('category', result.category)
      .not('grade', 'is', null)
      .order('grade', { ascending: false })

    if (error || !categoryResults) {
      console.error('Error calculating rank:', error)
      return { ...result, calculatedRank: undefined }
    }

    // العثور على ترتيب الطالب في القائمة
    const rank = categoryResults.findIndex(r => r.name === result.name) + 1
    
    return {
      ...result,
      calculatedRank: rank > 0 ? rank : undefined
    }
  }
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    setShouldSearch(true)
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Search Input */}
      <div className="mb-8">
        <SearchInput
          placeholder="ادخل الاسم الأول والثاني للبحث عن النتيجة..."
          onSearch={handleSearch}
          isLoading={isLoading}
          className="text-lg"
        />
        <p className="text-sm text-muted-foreground mt-2 text-center">
          يرجى كتابة الاسم الأول والثاني على الأقل للبحث
        </p>
      </div>

      {/* Loading State */}
      {isLoading && shouldSearch && (
        <Card className="w-full max-w-md mx-auto islamic-pattern">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
              <p className="text-muted-foreground">جاري البحث...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="w-full max-w-md mx-auto border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <SearchX className="h-8 w-8 text-destructive mx-auto mb-4" />
              <p className="text-destructive mb-2">حدث خطأ في البحث</p>
              {error?.message === 'يجب إدخال الاسم الأول والثاني على الأقل' ? (
                <p className="text-sm text-muted-foreground mb-3">
                  {error.message}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">
                  حدث خطأ غير متوقع في النظام
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                للتواصل والمساعدة: 
                <a 
                  href="https://wa.me/201559181558" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 font-semibold ml-1"
                >
                  +201559181558
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {!isLoading && shouldSearch && searchTerm && results && results.length === 0 && (
        <Card className="w-full max-w-md mx-auto border-warning/30 bg-warning/5">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <SearchX className="h-8 w-8 text-warning mx-auto mb-4" />
              <p className="text-warning-foreground mb-2">لم يتم العثور على نتائج</p>
              <p className="text-sm text-muted-foreground mb-3">
                تأكد من كتابة الاسم الأول والثاني بشكل صحيح
              </p>
              <p className="text-sm text-muted-foreground">
                إذا كنت غير راضٍ عن النتيجة أو تحتاج مساعدة: 
                <a 
                  href="https://wa.me/201559181558" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 font-semibold ml-1"
                >
                  واتساب +201559181558
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-6">
          {/* عرض النتيجة الأولى فقط */}
          {results.slice(0, 1).map((result) => (
            <ResultCard
              key={result.no}
              name={result.name || "غير محدد"}
              grade={result.grade || 0}
              category={result.category}
              rank={result.calculatedRank || result.rank}
            />
          ))}
        </div>
      )}

      {/* Initial State */}
      {!shouldSearch && (
        <Card className="w-full max-w-md mx-auto islamic-pattern border-accent/20">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="p-4 rounded-full bg-gradient-golden text-accent-foreground mx-auto mb-4 w-fit animate-float">
                <SearchX className="h-8 w-8" />
              </div>
              <p className="text-muted-foreground text-lg font-medium mb-4">
                ابدأ بكتابة الاسم الأول والثاني للبحث عن النتيجة
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                🎯 معايير النجاح: من 85 درجة فما فوق
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                للمساعدة أو الاستفسار أو إذا كنت غير راضٍ عن النتيجة: 
                <a 
                  href="https://wa.me/201559181558" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 font-semibold ml-1"
                >
                  واتساب +201559181558
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}