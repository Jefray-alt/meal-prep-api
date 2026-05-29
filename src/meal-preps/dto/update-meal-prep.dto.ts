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

class UpdateIngredientDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  quantity: string;
}

export class UpdateMealPrepDto {
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
  @IsOptional()
  @Type(() => UpdateIngredientDto)
  @ValidateNested({ each: true })
  ingredients?: UpdateIngredientDto[];

  @IsNotEmpty()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  protein?: number;

  @ArrayMaxSize(30)
  @ArrayMinSize(1)
  @IsArray()
  @IsNotEmpty({ each: true })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsNotEmpty()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;
}
