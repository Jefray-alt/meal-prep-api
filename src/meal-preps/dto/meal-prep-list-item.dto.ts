export interface MealPrepListItemDto {
  carbs: null | number;
  fat: null | number;
  firstTag: null | { id: string; name: string };
  id: string;
  protein: null | number;
  tagCount: number;
  title: string;
}
