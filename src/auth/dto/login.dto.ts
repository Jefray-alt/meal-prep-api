import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  declare email: string;

  @IsNotEmpty()
  @IsString()
  declare password: string;
}
