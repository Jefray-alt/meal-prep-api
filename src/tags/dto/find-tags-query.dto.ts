import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FindTagsQueryDto {
  @IsInt()
  @IsOptional()
  @Max(50)
  @Min(1)
  @Type(() => Number)
  limit: number = 10;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset: number = 0;

  @IsOptional()
  @IsString()
  search?: string;
}
