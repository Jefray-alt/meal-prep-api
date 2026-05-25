import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  declare email: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  declare firstName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  declare lastName: string;

  @IsString()
  @MinLength(8)
  declare password: string;
}
