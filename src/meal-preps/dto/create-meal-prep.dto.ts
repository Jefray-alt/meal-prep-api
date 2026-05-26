import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class IngredientDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  quantity: string;
}

export class CreateMealPrepDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  carbs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  fat?: number;

  @ArrayMaxSize(30)
  @ArrayMinSize(1)
  @IsArray()
  @Type(() => IngredientDto)
  @ValidateNested({ each: true })
  ingredients: IngredientDto[];

  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  instructions: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  protein?: number;

  @ArrayMaxSize(30)
  @ArrayMinSize(1)
  @IsArray()
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  tags: string[];

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  title: string;
}
