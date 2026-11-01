begin;
alter table public.sapa_pic_settings drop constraint sapa_pic_settings_setting_key_check;
alter table public.sapa_pic_settings add constraint sapa_pic_settings_setting_key_check check (setting_key in ('templates','activeTemplateKey','tableSettings','statuses','darkMode','podTemplate','podDelay','podUseSameTab','podSoundEnabled','appearance'));
insert into public.sapa_pic_settings(pic_name,setting_key,value)
select name,'appearance','{"theme":"ocean","accent":"#2563eb","dsColor":"#ef4444","regColor":"#3b82f6"}'::jsonb from public.sapa_pic_profiles
on conflict (pic_name,setting_key) do nothing;
notify pgrst, 'reload schema';
commit;
